from fastapi import FastAPI
from routers.pe import router as pe_router
from routers.shiller import router as shiller_router

app = FastAPI(title="AVM Analytics Service", version="1.0.0")
app.include_router(pe_router)
app.include_router(shiller_router)

@app.get("/health")
def health():
    return {"status": "ok"}
