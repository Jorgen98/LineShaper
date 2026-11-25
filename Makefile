fullAuth:
	ROUTER_AUTH=true EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
noAuth:
	ROUTER_AUTH=false EDITOR_AUTH=false docker compose --env-file ./api/.env up --build
noAuthNoDownload:
	ROUTER_AUTH=false EDITOR_AUTH=false NO_DOWNLOAD=true docker compose --env-file ./api/.env up --build
editorAuth:
	ROUTER_AUTH=false EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
routerAuth:
	ROUTER_AUTH=true EDITOR_AUTH=false docker compose --env-file ./api/.env up --build
fullAuthProd:
	ROUTER_AUTH=true EDITOR_AUTH=true docker compose --env-file ./api/.env up --build -d
noAuthProd:
	ROUTER_AUTH=false EDITOR_AUTH=false docker compose --env-file ./api/.env up --build -d
noAuthNoDownloadProd:
	ROUTER_AUTH=false EDITOR_AUTH=false NO_DOWNLOAD=true docker compose --env-file ./api/.env up --build -d
editorAuthProd:
	ROUTER_AUTH=false EDITOR_AUTH=true docker compose --env-file ./api/.env up --build -d
routerAuthProd:
	ROUTER_AUTH=true EDITOR_AUTH=false docker compose --env-file ./api/.env up --build -d
stop:
	docker compose down
