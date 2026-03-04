 from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
 from sqlalchemy.ext.asyncio import AsyncSession

 from app.api import deps
 from app.db.session import get_session
 from app.models.project import Project, ProjectStatus
 from app.models.user import User
 from app.services.dwg_converter import DWGConverter
 from app.services.storage import StorageService

 router = APIRouter(tags=["Upload"])


 @router.post("/upload", status_code=201)
 async def upload_project(
     file: UploadFile = File(...),
     current_user: User = Depends(deps.get_current_user),
     session: AsyncSession = Depends(get_session),
 ):
     if file.content_type not in ["application/acad", "application/dwg", "application/dxf", "application/octet-stream"]:
         raise HTTPException(status_code=400, detail="Formato não suportado. Envie DWG ou DXF.")

     storage = StorageService()
     stored_path = await storage.save_upload(file)
     dxf_path = stored_path

     if file.filename.lower().endswith(".dwg"):
         converter = DWGConverter()
         dxf_path = await converter.convert_to_dxf(stored_path)

     project = Project(
         user_id=current_user.id,
         name=file.filename.split(".")[0],
         original_filename=file.filename,
         file_path=stored_path,
         dxf_path=dxf_path,
         status=ProjectStatus.waiting_layers,
     )
     session.add(project)
     await session.commit()
     await session.refresh(project)

     return {"project_id": project.id, "status": project.status}
