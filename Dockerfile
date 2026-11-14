FROM node:26-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM golang:1.27-alpine AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY embed.go ./
COPY backend/ ./backend/
COPY --from=web /src/web/dist ./web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /treachery ./backend && mkdir /data

FROM gcr.io/distroless/static:nonroot
COPY --from=server /treachery /treachery
# a named volume mounted here inherits this ownership, so the nonroot user can write the snapshot
COPY --from=server --chown=nonroot:nonroot /data /data
ENV DATA_FILE=/data/rooms.json
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/treachery"]
