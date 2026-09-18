import requests

url = "http://localhost:8000/api/v1/auth/login"
data = {
    "email": "admin@test.com",
    "password": "hackathon123",
    "role": "admin"
}
try:
    response = requests.post(url, json=data)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
