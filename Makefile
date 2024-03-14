fullAuth:
	ROUTER_AUTH=true EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
noAuth:
	docker compose --env-file ./api/.env up --build
editorAuth:
	EDITOR_AUTH=true docker compose --env-file ./api/.env up --build
routerAuth:
	ROUTER_AUTH=true docker compose --env-file ./api/.env up --build