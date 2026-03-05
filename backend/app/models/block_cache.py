from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class BlockResolutionCache(SQLModel, table=True):
    """Cache compartilhado de resoluções de blocos DXF.

    Fontes possíveis (source):
      - "dictionary"  – veio do block_dictionary estático
      - "attdef"      – extraído dos ATTDEFs do bloco
      - "ai"          – resolvido via LLM
      - "user"        – corrigido manualmente por um usuário
    """

    __tablename__ = "block_resolution_cache"

    id: Optional[int] = Field(default=None, primary_key=True)
    block_name: str = Field(index=True)
    layer_hint: str | None = Field(default=None, index=True)
    description: str
    discipline: str | None = None
    category: str | None = None
    source: str = Field(default="ai")
    confidence: float = Field(default=0.5)
    confirmations: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
