FROM python:3.11-alpine

RUN pip install aiohttp flask jinja2 aiohttp_jinja2 websockets
RUN pip install keyboard

WORKDIR /app

COPY . .

CMD ["python", "main.py"]