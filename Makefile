fullAuth:
	ROUTER_AUTH=true EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
noAuth:
	docker compose --env-file ./api/.env up --build
editorAuth:
	EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
routerAuth:
	ROUTER_AUTH=true docker compose --env-file ./api/.env up --build
fullAuthProd:
	ROUTER_AUTH=true EDITOR_AUTH=true docker compose --env-file ./api/.env up --build -d
noAuthProd:
	docker compose --env-file ./api/.env up --build -d
editorAuthProd:
	EDITOR_AUTH=true docker compose --env-file ./api/.env up --build -d
routerAuthProd:
	ROUTER_AUTH=true docker compose --env-file ./api/.env up --build -d
stop:
	docker container stop lineShaper-proxyServer lineShaper-mapEditor lineShaper-lineRouter lineShaper-api lineShaper-db
