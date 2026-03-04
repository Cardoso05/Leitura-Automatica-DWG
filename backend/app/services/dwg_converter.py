import asyncio
from pathlib import Path

from fastapi import HTTPException

from app.core.config import get_settings


class DWGConverter:
    def __init__(self) -> None:
        self.settings = get_settings()
        if not self.settings.oda_converter_path:
            self.available = False
        else:
            self.available = True

    async def convert_to_dxf(self, dwg_path: str) -> str:
        if not self.available:
            raise HTTPException(
                status_code=500,
                detail="Conversor DWG não configurado. Defina ODA_CONVERTER_PATH.",
            )
        input_path = Path(dwg_path)
        output_dir = input_path.parent
        output_path = output_dir / f"{input_path.stem}.dxf"
        cmd = [
            self.settings.oda_converter_path,
            str(input_path.parent),
            str(output_dir),
            self.settings.oda_input_format,
            self.settings.oda_output_format,
            "0",  # Não audita
            "1",  # Recurse
        ]
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
        except FileNotFoundError:
            raise HTTPException(
                status_code=500,
                detail="ODA File Converter não encontrado no caminho configurado.",
            )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Falha na conversão DWG: {stderr.decode()}",
            )
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="DXF não gerado após conversão")
        return str(output_path)
