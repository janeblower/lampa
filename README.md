# Форк Lampa с web-сервером darkhttpd

Исходники лампы доступны тут: https://github.com/yumata/lampa-source

## Docker образ

1. Соберите образ `docker build --build-arg domain={domain} -t lampa . `
2. Запустите контейнер `docker run -p 8080:8080 -d --restart unless-stopped -it --name lampa lampa`

### Docker & Docker Compose

```bash
docker run --rm -d --restart unless-stopped --name lampa -p 8080:80 pull ghcr.io/janeblower/lampa:latest
```

#### Docker Compose

```yml
# docker-compose.yml

version: '3.3'
services:
    lampa:
        image: ghcr.io/janeblower/lampa:latest
        container_name: lampa
        ports:
            - 8080:8080
        restart: unless-stopped
    ...

```