 from app.models.project import Discipline

 KEYWORDS = {
     Discipline.electrical: ["ele", "elet", "lighting", "luz", "tomada"],
     Discipline.plumbing: ["hid", "água", "san", "pipe", "ppr", "hidr"],
     Discipline.networking: ["net", "dados", "cftv", "logic", "lan"],
     Discipline.fire: ["incend", "sprink", "hidrante", "hidr"],
     Discipline.hvac: ["hvac", "ar", "duto", "clima"],
 }


 def guess_discipline(layer_name: str) -> Discipline | None:
     lname = layer_name.lower()
     for discipline, patterns in KEYWORDS.items():
         if any(pattern in lname for pattern in patterns):
             return discipline
     return None
