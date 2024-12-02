import { Component, OnInit, ViewChild } from '@angular/core';
import { MapService } from './map/map.service';
import { AppDirective } from './app.directive';
import { TileSelectComponent } from './tile-select/tile-select';
import { DataService } from './data.service';
import { FilesManipulationComponent } from './files-manipulation/files-manipulation';
import { RoutingComponent } from './routing/routing';
import { MidPointsComponent } from './mid-points/mid-points';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrls: ['./app.css'],
    standalone: false
})

export class AppComponent implements OnInit {
    constructor(private mapService: MapService, private dataService:DataService, private translate: TranslateService) {
        this.mapService.onRoutingEvent().subscribe((state) => {
            this.btnDisabled = state;
        })
    }
    @ViewChild(AppDirective, { static: true}) mapTiles!: AppDirective;
    menuIndexBtn = ["", "", "", "", ""];
    newItems = false;
    btnDisabled = false;
    mapDisabledZIndex = 0;
    acLang = 'EN';
    loginScreen = true;
    loginWarning = false;
    logInName = '';
    logInPassword = '';
    
    async ngOnInit() {
        this.openMenuItem(2);
        this.closeMenuItem();
        this.menuIndexBtn[2] = "";

        // If authentication is not enabled, app will get clear JWT token
        if (await this.dataService.connectToDB('', '')) {
            this.loginScreen = false;
            this.mapService.cleanWhatIsOnMap();
        }
    }

    // If authentication is enabled, login screen will be show and user need to log in to get JWT token
    async logIn() {
        let result = await this.dataService.connectToDB(this.logInName, this.logInPassword);
        if (result) {
            this.loginScreen = false;
            this.mapService.cleanWhatIsOnMap();
        } else {
            this.loginWarning = true;
        }
    }

    zoomIn(): void {
        this.mapService.zoomIn();
    }

    zoomOut(): void {
        this.mapService.zoomOut();
    }

    // Open tool tab
    openMenuItem(id: number): void {
        this.closeMenuItem();
        if (this.menuIndexBtn[id] != "") {
            this.menuIndexBtn[id] = "";
            return;
        }

        for (let i = 0; i < this.menuIndexBtn.length; i++) {
            if (this.menuIndexBtn[i] != "") {
                this.menuIndexBtn[i] = "";
            }
        }
        
        this.menuIndexBtn[id] = "selBtn";
        const viewContainerRef = this.mapTiles.viewContainerRef;
        switch (id) {
            case 0: viewContainerRef.createComponent(TileSelectComponent); break;
            case 2: viewContainerRef.createComponent(FilesManipulationComponent); break;
            case 3: viewContainerRef.createComponent(RoutingComponent); break;
            case 4: viewContainerRef.createComponent(MidPointsComponent); break;
            default: break;
        }
    }

    closeMenuItem(): void {
        const viewContainerRef = this.mapTiles.viewContainerRef;
        viewContainerRef.clear();
    }

    // Change app language
    changeLang() {
        if (this.acLang === 'EN') {
            this.acLang = 'CZ';
            this.translate.use('en');
        } else {
            this.acLang = 'EN';
            this.translate.use('cz');
        }

        this.loginWarning = false;
    }
}
