import { Component } from '@angular/core';
import { DataService } from '../data.service';
import { MapService } from '../map/map.service';
import { formatDate } from '@angular/common';

@Component({
    selector: 'files-manipulation',
    templateUrl: './files-manipulation.html',
    styleUrls: ['./files-manipulation.css']
})

export class FilesManipulationComponent {
    constructor(private dataService: DataService, private mapService: MapService) {}
    state = 'menu';
    warning = false;
    warningText = "";
    warningType = false;
    warningTypeText = "";
    acStopsFileContent: any = undefined;
    acLinesFileContent: any = undefined;
    acLineCodesFileContent: any = undefined;
    acMidPointFileContent: any = undefined;
    progress = 0;
    progressText = "";
    loadState = 0;

    async defaultMenu() {
        this.warning = false;
        this.warningType = false;
        this.warningText = "";
        this.warningTypeText = "";
        this.acStopsFileContent = undefined;
        this.acLinesFileContent = undefined;
        this.acLineCodesFileContent = undefined;
        this.acMidPointFileContent = undefined;
        this.state = 'menu';
    }

    readFile(event: any) {
        if (event.target.files[0] === undefined) {
            this.warningType = true;
            this.warningTypeText = "Vybraný soubor se nepodařilo načíst";
            return;
        }

        for (let i = 0; i < event.target.files.length; i++) {
            // Line order file
            if (event.target.files[i].type === "text/csv" && event.target.files[i].name.includes('Order')) {
                this.readFileContent(event.target.files[i], 0);
            // Stops txt file
            } else if (event.target.files[i].type === "text/plain" && event.target.files[i].name.includes('Zastavky')) {
                this.readFileContent(event.target.files[i], 1);
            // Line codes file
            } else if (event.target.files[i].type === "text/csv" && event.target.files[i].name.includes('Labels')) {
                this.readFileContent(event.target.files[i], 2);
            // MidPoints file
            } else if (event.target.files[i].type === "application/geo+json" && event.target.files[i].name.includes('midpoints')) {
                this.readFileContent(event.target.files[i], 3);
            }
        }
    }

    readFileContent(file: any, type: number) {
        let fileReader = new FileReader();
        fileReader.onload = () => {
            try {
                if (fileReader.result === null) {
                    this.warningType = true;
                    this.warningTypeText = "Chyba při načítání dat, vybraný soubor není ve správném formátu";
                } else {
                    if (type === 0) {
                        this.acLinesFileContent = fileReader.result;
                    } else if (type === 1) {
                        this.acStopsFileContent = fileReader.result;
                    } else if (type === 2) {
                        this.acLineCodesFileContent = fileReader.result;
                    } else {
                        this.acMidPointFileContent = fileReader.result;
                    }
                }
            } catch {
                this.warningType = true;
                this.warningTypeText = "Chyba při načítání dat, vybraný soubor není ve správném formátu";
                return;
            }
            this.warningType = false;
        }

        fileReader.readAsText(file, "iso-8859-2");
    }

    async importData() {
        if (this.state !== "impData") {
            this.state = "impData";
            return;
        }

        let stats = await this.dataService.getStats();

        if (this.acStopsFileContent === undefined && this.acLinesFileContent === undefined
            && this.acLineCodesFileContent === undefined && this.acMidPointFileContent === undefined) {
            this.state = "impNoDataWar";
            return;
        }

        if (stats['stops'] > 0 || stats['signs'] > 0 || stats['lines'] > 0 || stats['lineCodes'] > 0 || stats['midpoints'] > 0) {
            this.state = "impDataWar";
            return;
        }

        this.importDataIntroDB();
    }

    async importDataIntroDB() {
        if (this.progress === 100) {
            this.progress = 0;
            this.defaultMenu();
            return;
        }

        if (this.acStopsFileContent !== undefined) {
            await this.importStopsIntroDB();
        }

        if (this.acLinesFileContent !== undefined) {
            await this.importLinesIntroDB();
        }

        if (this.acLineCodesFileContent !== undefined) {
            await this.importLineCodesIntroDB();
        }

        if (this.acMidPointFileContent !== undefined) {
            await this.importMidPointsIntroDB();
        }
    }

    async importStopsIntroDB() {
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Zpracování dat";
        await this.dataService.clearData('stops');

        let input = this.acStopsFileContent.split('\r\n');
        let stops: {code: number, name: string, signs: {[latLng: string]: string []}} [] = [];

        for (let i = 0; i < input.length;) {
            let inputLine = input[i].split(" ");
            let stopCode = parseInt(inputLine[0]);
            if (inputLine[2] !== undefined) {
                let j = 0;
                let name = inputLine[2];

                // Get stop name
                while(inputLine[2 + j][inputLine[2 + j].length - 1] === ',' || inputLine[2 + j][inputLine[2 + j].length - 1] !== "'") {
                    j++;
                    name += ' ' + inputLine[2 + j];
                }

                // Fix non-UTF format shit
                name = this.isoFix(name);
                name = name.replaceAll('&', "a");

                // Prepare single stop sign data
                // Be careful, there can be more signs on with same position
                let stopSigns: {[latLng: string]: string []} = {};
                i++;
                inputLine = input[i].split(" ");
                while (inputLine[0] === "" && inputLine[1] === "") {
                    let latLng = (parseInt(inputLine[4])/100000/60).toFixed(5).toString() + '_' + (parseInt(inputLine[3])/100000/60).toFixed(5).toString();
                    let signCode = parseInt(inputLine[2].replaceAll("S", "")).toString();
                
                    if (stopSigns[latLng] === undefined)  {
                        stopSigns[latLng] = [signCode];
                    } else {
                        stopSigns[latLng] = stopSigns[latLng].concat(signCode);
                    }

                    i++;
                    inputLine = input[i].split(" ");
                }
                
                // Check if stop already exists and store stopSigns
                let existStop = stops.find((stop) => {return stop.code === stopCode});
                if (existStop !== undefined) {
                    let newSigns = Object.keys(stopSigns);
                    for (const sign in newSigns) {
                        if (existStop.signs[sign] !== undefined) {
                            existStop.signs[sign] = existStop.signs[sign].concat(stopSigns[sign]);
                        }
                    }
                } else if (Object.keys(stopSigns).length > 0) {
                    stops.push({code: stopCode, name: name.replaceAll("'", ""), signs: stopSigns});
                }
            } else {
                i++;
            }
        }
        
        // Upload data to DB
        let upIndex = 10;
        for (let i = 0; i < stops.length; i+=10) {
            if (upIndex > (stops.length - 1)) {
                upIndex = stops.length;
            }
            await this.dataService.createPoints(stops.slice(i, upIndex));
            upIndex += 10;
            this.progress = Math.round(i / stops.length * 100);
        }

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }


    async importLinesIntroDB() {
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Zpracování dat";
        await this.dataService.clearData('lines');

        let content = this.acLinesFileContent.split('\r\n');
        let lines: any = [];
        let savedLines: any = [];

        for (let i = 1; i < content.length;) {
            let line = content[i].split(";");
            let record: any = {'lc': line[0], 'type': line[1], 'routeA': [], 'routeB': []};
            let routeA: any = [];
            let routeB: any = [];

            do {
                if (line[4] !== '' && line[5] !== '' &&
                    line[4] !== undefined && line[5] !== undefined) {

                    if (line[3] === "konečná") {
                        if (line[5].split(',').length > 1) {
                            routeA.push(line[4] + '_' + line[5].split(',')[0] + '_k');
                            routeA.push(line[4] + '_' + line[5].split(',')[1] + '_k');
                        } else {
                            routeA.push(line[4] + '_' + line[5] + '_k');
                        }
                    } else {
                        if (line[5].split(',').length > 1) {
                            routeA.push(line[4] + '_' + line[5].split(',')[0] + '_p');
                            routeA.push(line[4] + '_' + line[5].split(',')[1] + '_p');
                        } else {
                            routeA.push(line[4] + '_' + line[5]);
                        }
                    }
                }
                if (line[4] !== '' && line[6] !== '' &&
                    line[4] !== undefined && line[6] !== undefined) {
                    
                    if (line[3] === "konečná") {
                        if (line[6].split(',').length > 1) {
                            routeB.unshift(line[4] + '_' + line[6].split(',')[0] + '_k');
                            routeB.unshift(line[4] + '_' + line[6].split(',')[1] + '_k');
                        } else {
                            routeB.unshift(line[4] + '_' + line[6] + '_k');
                        }
                    } else {
                        if (line[6].split(',').length > 1) {
                            routeB.unshift(line[4] + '_' + line[6].split(',')[0] + '_p');
                            routeB.unshift(line[4] + '_' + line[6].split(',')[1] + '_p');
                        } else {
                            routeB.unshift(line[4] + '_' + line[6]);
                        }
                    }
                }

                i++;
                if (content[i] !== undefined) {
                    line = content[i].split(";");
                } else {
                    break;
                }
            } while(line[0] === '' && i < content.length)

            record.routeA = routeA;
            record.routeB = routeB;

            if (record.type === 'Vlak') {
                record.type = 'rail';
            } else if (record.type === 'Bus') {
                record.type = 'road';
            } else if (record.type === 'Trolej') {
                record.type = 'road';
            } else if (record.type === 'Tram') {
                record.type = 'tram';
            }

            if (savedLines.indexOf(record.lc) === -1 && parseInt(record.lc) < 100) {
                lines.push(record);
                savedLines.push(record.lc);
            }
        }
        
        let upIndex = 10;
        for (let i = 0; i < lines.length; i+=10) {
            if (upIndex > (lines.length - 1)) {
                upIndex = lines.length;
            }
            await this.dataService.saveLines(lines.slice(i, upIndex));
            upIndex += 10;
            this.progress = Math.round(i / lines.length * 100);
        }

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }

    async importLineCodesIntroDB() {
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Zpracování dat";
        await this.dataService.clearData('lineCodes');

        let content = this.acLineCodesFileContent.split('\r\n');
        let lines: any = [];

        for (let i = 0; i < content.length; i++) {
            let line = content[i].split(";");
            let record: any;

            if (line[0] !== undefined && line[1] !== undefined && line[1] !== '') {
                record = {'lc': parseInt(line[0]), 'lName': this.isoFix(line[1])};
                lines.push(record);
            }
        }
        
        let upIndex = 20;
        for (let i = 0; i < lines.length; i+=20) {
            if (upIndex > (lines.length - 1)) {
                upIndex = lines.length;
            }
            await this.dataService.saveLineCodes(lines.slice(i, upIndex));
            upIndex += 20;
            this.progress = Math.round(i / lines.length * 100);
        }

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }

    async importMidPointsIntroDB() {
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Zpracování dat";
        await this.dataService.clearData('midpoints');

        let content = JSON.parse(this.acMidPointFileContent);
        if (content.type === 'midpoints') {
            for (let i = 0; i < content.records.length; i++) {
                await this.dataService.addMidpoint(content.records[i].endcodesa, content.records[i].endcodesb, content.records[i].midpoints);
                this.progress = Math.round(i / content.records.length * 100);
            }
        }

        this.progressText = "Zpracování dat je dokončeno"
        this.progress = 100;
    }

    async exportMidPointData() {
        if (this.progress === 100) {
            this.progress = 0;
            this.defaultMenu();
            return;
        }
        this.state = 'progress';
        this.progress = 0;
        this.progressText = "Export dat";

        let data = [];
        let id = 0;
        let recNum = (await this.dataService.getStats())['midpoints'];
        let procRec = 0;
        let result: any = [];
        let indexes: any = {};
        while ((data = await this.dataService.getMidPointsById(id)).length > 0) {
            id = data[data.length - 1].id;
            for (let i = 0; i < data.length; i++, procRec++) {
                result.push(data[i]);
                indexes[data[i].id] = procRec;
            }
            this.progress = Math.round(procRec / recNum * 100);
            data = [];
        }

        for (let i = 0; i < result.length; i++) {
            delete result[i].id;
            result[i].midpoints = JSON.parse(JSON.stringify(result[i].midpoints));
        }

        let filename = "midpoints_" + formatDate(new Date(), 'yyyy-MM-dd', 'en') + ".geojson";
        let blob = new Blob([JSON.stringify({"type": 'midpoints',
            "valid": formatDate(new Date(), 'yyyy-MM-dd', 'en'), "records": result})], { type: 'text/json' });

        let a = document.createElement("a");
        document.body.appendChild(a);
        a.setAttribute('download', filename);
        a.style.display = 'none';
        a.href = window.URL.createObjectURL(blob);
        a.download = filename;
        a.click();

        this.progressText = "Exportování dat je dokončeno"
        this.progress = 100;
    }

    isoFix(input: string) {
        input = input.replaceAll('\u009a', "š");
        input = input.replaceAll('\u009e', "ž");
        input = input.replaceAll('\u009d', "ť");
        input = input.replaceAll('\u008a', "Š");
        input = input.replaceAll('\u008e', "Ž");
        input = input.replaceAll('\u008d', "Ť");
        return input;
    }
}
