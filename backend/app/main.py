from fastapi import FastAPI

app = FastAPI(title="Sudo IQ API")


@app.get("/")
def root():
    return {
        "message": "Sudo IQ API is running",
        "status": "healthy"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }