run:
	docker compose --env-file ./api/.env up --build
api-development:
	docker compose --env-file ./api/.env up postgis --build
ui-development:
	docker compose --env-file ./api/.env up postgis api --build
