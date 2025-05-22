# LineShaper

Interactive tool for generating geographically accurate definitions of routes of the Integrated Transport System of the South Moravian Region created for the company [KORDIS JMK, a.s.](https://www.idsjmk.cz/a/kordis-jmk.html)

The tool consists of two parts:
 - **Map Editor** - Allows to manage, import and export the transport networks
 - **Line Router** - Based on imported data about the transit system structure, it generates geographically accurate complex route definitions for individual lines. It also allows modification of the structure of the lines themselves.

## Usage
 1. Create `api/.env` file, example is located in `api/.example.env` directory.
 3. In the `api/.env` file, set the `DB_USER` and `DB_PASSWORD` variables. If you want to use authentication, also set the `EDITOR_USERS` and `ROUTER_USERS` variables.
 4. The tool can be run in 4 modes:
	 - `make fullAuth` - Authentication is enabled for both map editing and line router
	 - `make noAuth` - Authentication is disabled
	 - `make editorAuth` - Authentication is enabled only for the map editor, line router is accessible without login
	 - `make routerAuth` - Authentication is enabled only for line router, the map editor is accessible without logging in
	 - `make noAuthNoDownload` - Authentication is disabled, transport layers export is disabled
 5. After build and startup, the application runs on `http://your_url/lineShaper`
 6. Application can be stopped by `make stop`
 7. If you want to run application on background, just add `Prod` to any configuration (e. `make fullAuthProd`)

## Input Files

The **Map Editor** works with 3 separate transport networks, which can be created directly in the editor or imported from special .geojson files, examples of which are contained in the `exampleFiles/editor` folder.
The **Line Router** works with two types of files:
 - Structural files containing a description of the transport system. Attention! Due to the nature of internal Kordis system, provided example files `Zastavky.txt`, `LineOrder.csv` and `LineLabels.csv` has atypical encoding `iso-8859-2`. Fell free to use your files with standard `UTF-8` encoding, but be careful about the files structure itself. The `Zastavky.txt` file contains the stops of the public transport system, the `LineOrder.csv` file contains the structure of the lines, and the optional `LineLabels.csv` file contains pairs of codes and actual labels for each line. Examples of all files are contained in the `exampleFiles/router` folder.
 - In addition to the system structure, the line router operates within the line structure editing with waypoints for more accurate routing. These waypoints can be imported or exported to the `midpoints.geojson` file. An example of this file can be found in the `exampleFiles/router` folder.

The structure of all files is described in more detail in the attached user manual.

## License
This project is licensed under GPL-3.0.
