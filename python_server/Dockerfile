FROM python:3.11-alpine

RUN pip install aiohttp flask jinja2 aiohttp_jinja2 websockets

WORKDIR /app

COPY . .

CMD ["python", "main.py"]