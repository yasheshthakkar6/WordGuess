
import os
from schemas import *
from database import *
from fastapi import FastAPI,HTTPException
from jose import jwt
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from sqlalchemy import or_
from auth import autenticat_curr_user, SECRET_KEY, ALGORITHM, pwd_context
from game import router as game_router
from datetime import datetime, timedelta,timezone
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
app.include_router(game_router)


app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET_KEY"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    
)
@app.post('/register')

def register(user : RegisterSchema):
    db = SessionLocal()
    try:
        exist_user = db.query(RegisterDb).filter(or_(RegisterDb.username == user.username, RegisterDb.email == user.email)).first()

        if exist_user:
            raise HTTPException(
                status_code = 400,
                detail = "User Already exists..!!"
            )
        hash_password = pwd_context.hash(user.password)
        new_user = RegisterDb(
            first_name = user.first_name,
            last_name = user.last_name,
            email = user.email,
            username = user.username,
            password = hash_password,
            profile_image = user.profile_image
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return {
            "message":"User Registration was a Success..!!",
            "data":{
                "first_name": new_user.first_name,
                "last_name": new_user.last_name,
                "email": new_user.email,
                "username":new_user.username,
                "profile_image":new_user.profile_image
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        return {"message":f"Error while Registering {e}..!!"}
    finally :
        db.close()

@app.get('/register')

def get_register():
    db = SessionLocal()

    try:
        all_regis = db.query(RegisterDb).all()
        return {
            "message":"All Registration Rendered" if all_regis else "NO Registration Found.. Register to get data",
            "data":[{
                "first_name":users.first_name,
                "last_name":users.last_name,
                "email":users.email,
                "username":users.username,
                "created_at":users.created_at,
                "profile_image":users.profile_image
            }  for users in all_regis]
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"message":f"Error while Registerition.{e}..!!"}
    finally :
        db.close()

@app.post('/login')

def logiin(user : LoginSchema):
    db = SessionLocal()

    try:
        curr_user = db.query(RegisterDb).filter(RegisterDb.username == user.username).first()

        if not curr_user:
            raise HTTPException(
                status_code = 400,
                detail = "No User Found..!"
            )
        verify_user = pwd_context.verify(user.password,curr_user.password)

        if not verify_user:
            raise HTTPException(
                status_code = 400,
                detail = "Incorrect Password..!!"
            )
        expire_time = datetime.now(timezone.utc) + timedelta(hours = 1)

        token = jwt.encode({"username":curr_user.username,"exp":expire_time},SECRET_KEY,algorithm=ALGORITHM)

        return {
            "access_token": token,
            "token_type":"Bearer",
            "username":curr_user.username,
            "first_name":curr_user.first_name
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"message":f"Error while Registerition.{e}..!!"}
    finally :
        db.close()