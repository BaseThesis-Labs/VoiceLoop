from pydantic import BaseModel, EmailStr


class DeveloperCreate(BaseModel):
    name: str
    email: EmailStr


class DeveloperResponse(BaseModel):
    id: str
    name: str
    email: str
    api_key: str  # Only returned on creation (plaintext)

    model_config = {"from_attributes": True}


class DeveloperInfo(BaseModel):
    id: str
    name: str
    email: str

    model_config = {"from_attributes": True}
