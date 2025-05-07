fullAuth:
	ROUTER_AUTH=true EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
noAuth:
	docker compose --env-file ./api/.env up --build
noAuthNoDownload:
	NO_DOWNLOAD=true docker compose --env-file ./api/.env up --build
editorAuth:
	EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
routerAuth:
	ROUTER_AUTH=true docker compose --env-file ./api/.env up --build
fullAuthProd:
	ROUTER_AUTH=true EDITOR_AUTH=true docker compose --env-file ./api/.env up --build -d
noAuthProd:
	docker compose --env-file ./api/.env up --build -d
noAuthNoDownloadProd:
	NO_DOWNLOAD=true docker compose --env-file ./api/.env up --build -d
editorAuthProd:
	EDITOR_AUTH=true docker compose --env-file ./api/.env up --build -d
routerAuthProd:
	ROUTER_AUTH=true docker compose --env-file ./api/.env up --build -d
stop:
	docker container stop line-shaper-proxy-server line-shaper-map-editor line-shaper-line-router line-shaper-api line-shaper-db
