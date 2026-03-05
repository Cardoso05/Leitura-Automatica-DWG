import math
import re
from datetime import datetime
from pathlib import Path

import ezdxf
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from loguru import logger
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api import deps
from app.db.session import get_session
from app.models.block_cache import BlockResolutionCache
from app.models.project import Project
from app.models.user import User

router = APIRouter(prefix="/blocks", tags=["Blocks"])

_GEOMETRIC_TYPES = {"LINE", "CIRCLE", "ARC", "LWPOLYLINE", "POLYLINE", "ELLIPSE", "SPLINE"}

_SAFE_BLOCK_NAME = re.compile(r"^[\w\$\*\-\.\+\s]{1,120}$", re.UNICODE)

_doc_cache: dict[str, ezdxf.document.Drawing] = {}


def _load_dxf(path: Path) -> ezdxf.document.Drawing:
    key = str(path)
    cached = _doc_cache.get(key)
    if cached is not None:
        return cached
    doc = ezdxf.readfile(str(path))
    if len(_doc_cache) > 8:
        _doc_cache.pop(next(iter(_doc_cache)))
    _doc_cache[key] = doc
    return doc


@router.get("/{project_id}/{block_name:path}/preview")
async def block_preview(
    project_id: int,
    block_name: str,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Gera SVG miniatura de um bloco para identificação visual."""
    if not _SAFE_BLOCK_NAME.match(block_name):
        return Response(content=_empty_svg(120, 120), media_type="image/svg+xml")

    stmt = select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")

    dxf_file = project.dxf_path or project.file_path
    if not dxf_file:
        raise HTTPException(status_code=404, detail="Arquivo DXF não encontrado para este projeto")

    local_path = Path(dxf_file)
    if not local_path.exists():
        logger.warning("Block preview: arquivo não existe em %s", local_path.resolve())
        raise HTTPException(status_code=404, detail="Arquivo DXF não encontrado no storage")

    try:
        doc = _load_dxf(local_path)
        block_def = _resolve_renderable_block(doc, block_name)
        if block_def is None:
            return Response(content=_empty_svg(120, 120), media_type="image/svg+xml")
    except Exception as exc:
        logger.debug("Block preview error for %s: %s", block_name, exc)
        return Response(content=_empty_svg(120, 120), media_type="image/svg+xml")

    svg = _render_block_to_svg(block_def)
    return Response(content=svg, media_type="image/svg+xml")


def _resolve_renderable_block(doc, block_name: str, depth: int = 0, max_depth: int = 4):
    """
    Resolve um bloco para sua definição com geometria renderizável.
    Segue INSERTs aninhados quando o bloco não tem geometria direta.
    """
    if depth > max_depth:
        return None
    try:
        block_def = doc.blocks.get(block_name)
        if block_def is None:
            return None

        has_geometry = any(e.dxftype() in _GEOMETRIC_TYPES for e in block_def)

        if has_geometry:
            return block_def

        # Sem geometria direta — seguir INSERTs aninhados
        for e in block_def:
            if e.dxftype() == "INSERT":
                nested = _resolve_renderable_block(doc, e.dxf.name, depth + 1, max_depth)
                if nested is not None:
                    return nested

        return block_def
    except Exception:
        return None


def _render_block_to_svg(block_def, width: int = 120, height: int = 120, padding: int = 10) -> str:
    entities = list(block_def)
    if not entities:
        return _empty_svg(width, height)

    points: list[tuple[float, float]] = []
    svg_elements: list[tuple] = []

    for e in entities:
        etype = e.dxftype()
        try:
            if etype == "LINE":
                s, end = e.dxf.start, e.dxf.end
                points.extend([(s[0], s[1]), (end[0], end[1])])
                svg_elements.append(("line", s, end))

            elif etype == "CIRCLE":
                c, r = e.dxf.center, e.dxf.radius
                points.extend([(c[0] - r, c[1] - r), (c[0] + r, c[1] + r)])
                svg_elements.append(("circle", c, r))

            elif etype == "ARC":
                c, r = e.dxf.center, e.dxf.radius
                points.extend([(c[0] - r, c[1] - r), (c[0] + r, c[1] + r)])
                sa = math.radians(e.dxf.start_angle)
                ea = math.radians(e.dxf.end_angle)
                svg_elements.append(("arc", c, r, sa, ea))

            elif etype == "LWPOLYLINE":
                pts = [(p[0], p[1]) for p in e.get_points()]
                if pts:
                    points.extend(pts)
                    svg_elements.append(("polyline", pts, e.closed))

            elif etype == "POLYLINE":
                verts = list(e.vertices)
                pts = [(v.dxf.location[0], v.dxf.location[1]) for v in verts]
                if pts:
                    points.extend(pts)
                    svg_elements.append(("polyline", pts, e.is_closed))

            elif etype == "ELLIPSE":
                c = e.dxf.center
                # Aproximar elipse pelo bounding box do semi-eixo maior
                major = e.dxf.major_axis
                ratio = e.dxf.ratio
                rx = math.sqrt(major[0] ** 2 + major[1] ** 2)
                ry = rx * ratio
                points.extend([(c[0] - rx, c[1] - ry), (c[0] + rx, c[1] + ry)])
                svg_elements.append(("ellipse", c, rx, ry))

            elif etype == "SPLINE":
                ctrl_pts = list(e.control_points)
                if ctrl_pts:
                    pts = [(p[0], p[1]) for p in ctrl_pts]
                    points.extend(pts)
                    svg_elements.append(("polyline", pts, False))

        except Exception:
            continue

    if not points:
        return _empty_svg(width, height)

    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)

    dx = max_x - min_x or 1.0
    dy = max_y - min_y or 1.0
    usable = min(width, height) - 2 * padding
    scale = usable / max(dx, dy)

    def tx(x: float) -> float:
        return (x - min_x) * scale + padding

    def ty(y: float) -> float:
        return height - ((y - min_y) * scale + padding)

    stroke = "#00D4AA"
    # viewBox é obrigatório para o <img> escalar corretamente no browser
    parts: list[str] = [
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'xmlns="http://www.w3.org/2000/svg">',
        f'<rect width="100%" height="100%" fill="#0F2B3C" rx="8"/>',
    ]

    for elem in svg_elements:
        try:
            if elem[0] == "line":
                _, s, end = elem
                parts.append(
                    f'<line x1="{tx(s[0]):.1f}" y1="{ty(s[1]):.1f}" '
                    f'x2="{tx(end[0]):.1f}" y2="{ty(end[1]):.1f}" '
                    f'stroke="{stroke}" stroke-width="2" stroke-linecap="round"/>'
                )
            elif elem[0] == "circle":
                _, c, r = elem
                parts.append(
                    f'<circle cx="{tx(c[0]):.1f}" cy="{ty(c[1]):.1f}" '
                    f'r="{max(r * scale, 1.0):.1f}" '
                    f'stroke="{stroke}" fill="none" stroke-width="2"/>'
                )
            elif elem[0] == "arc":
                _, c, r, sa, ea = elem
                sx = tx(c[0] + r * math.cos(sa))
                sy = ty(c[1] + r * math.sin(sa))
                ex = tx(c[0] + r * math.cos(ea))
                ey = ty(c[1] + r * math.sin(ea))
                sr = max(r * scale, 1.0)
                large = 1 if (ea - sa) % (2 * math.pi) > math.pi else 0
                parts.append(
                    f'<path d="M {sx:.1f} {sy:.1f} A {sr:.1f} {sr:.1f} 0 {large} 0 '
                    f'{ex:.1f} {ey:.1f}" stroke="{stroke}" fill="none" stroke-width="2"/>'
                )
            elif elem[0] == "polyline":
                _, pts, closed = elem
                if len(pts) >= 2:
                    coords = " ".join(f"{tx(p[0]):.1f},{ty(p[1]):.1f}" for p in pts)
                    tag = "polygon" if closed else "polyline"
                    parts.append(
                        f'<{tag} points="{coords}" '
                        f'stroke="{stroke}" fill="none" stroke-width="2" stroke-linejoin="round"/>'
                    )
            elif elem[0] == "ellipse":
                _, c, rx, ry = elem
                parts.append(
                    f'<ellipse cx="{tx(c[0]):.1f}" cy="{ty(c[1]):.1f}" '
                    f'rx="{max(rx * scale, 1.0):.1f}" ry="{max(ry * scale, 1.0):.1f}" '
                    f'stroke="{stroke}" fill="none" stroke-width="2"/>'
                )
        except Exception:
            continue

    parts.append("</svg>")
    return "\n".join(parts)


def _empty_svg(w: int, h: int) -> str:
    return (
        f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg">'
        f'<rect width="100%" height="100%" fill="#0F2B3C" rx="8"/>'
        f'<text x="50%" y="46%" text-anchor="middle" dominant-baseline="middle" '
        f'fill="#3B5A6E" font-size="32" font-family="Arial" font-weight="bold">?</text>'
        f'<text x="50%" y="78%" text-anchor="middle" dominant-baseline="middle" '
        f'fill="#2A4454" font-size="9" font-family="Arial">sem preview</text></svg>'
    )


# ---------------------------------------------------------------------------
# Feedback de usuários e cache de blocos
# ---------------------------------------------------------------------------

class BlockFeedbackPayload(BaseModel):
    block_name: str
    layer: str | None = None
    description: str
    discipline: str | None = None
    category: str | None = None


class BlockCacheRead(BaseModel):
    id: int
    block_name: str
    layer_hint: str | None
    description: str
    discipline: str | None
    category: str | None
    source: str
    confidence: float
    confirmations: int

    class Config:
        from_attributes = True


@router.post("/feedback", response_model=BlockCacheRead, status_code=201)
async def submit_block_feedback(
    payload: BlockFeedbackPayload,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Usuário corrige/confirma a descrição de um bloco. Salva no cache compartilhado."""
    stmt = select(BlockResolutionCache).where(
        BlockResolutionCache.block_name == payload.block_name
    )
    existing = (await session.execute(stmt)).scalar_one_or_none()

    if existing:
        if existing.description.lower() == payload.description.lower():
            existing.confirmations += 1
            existing.confidence = min(1.0, existing.confidence + 0.1)
        else:
            existing.description = payload.description
            existing.discipline = payload.discipline
            existing.category = payload.category
            existing.source = "user"
            existing.confidence = 0.9
            existing.confirmations += 1
        existing.updated_at = datetime.utcnow()
        await session.commit()
        await session.refresh(existing)
        return existing

    entry = BlockResolutionCache(
        block_name=payload.block_name,
        layer_hint=payload.layer,
        description=payload.description,
        discipline=payload.discipline,
        category=payload.category,
        source="user",
        confidence=0.9,
        confirmations=1,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return entry


@router.get("/cache/stats")
async def block_cache_stats(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Retorna estatísticas do cache de blocos."""
    from sqlalchemy import func

    total_stmt = select(func.count(BlockResolutionCache.id))
    total = (await session.execute(total_stmt)).scalar_one()

    by_source = {}
    for source in ("ai", "user", "attdef", "dictionary"):
        cnt_stmt = select(func.count(BlockResolutionCache.id)).where(
            BlockResolutionCache.source == source
        )
        by_source[source] = (await session.execute(cnt_stmt)).scalar_one()

    high_conf_stmt = select(func.count(BlockResolutionCache.id)).where(
        BlockResolutionCache.confidence >= 0.8
    )
    high_conf = (await session.execute(high_conf_stmt)).scalar_one()

    return {
        "total": total,
        "by_source": by_source,
        "high_confidence": high_conf,
    }


@router.get("/cache/search")
async def search_block_cache(
    q: str,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Busca blocos no cache por nome."""
    stmt = select(BlockResolutionCache).where(
        BlockResolutionCache.block_name.ilike(f"%{q}%")
    ).limit(50)
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "block_name": r.block_name,
            "description": r.description,
            "discipline": r.discipline,
            "source": r.source,
            "confidence": r.confidence,
            "confirmations": r.confirmations,
        }
        for r in rows
    ]
