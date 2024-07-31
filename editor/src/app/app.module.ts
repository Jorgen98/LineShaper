import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppComponent } from './app';
import { MapComponent } from './map/map';
import { AppDirective } from './app.directive';
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FilesManipulationComponent } from './files-manipulation/files-manipulation';
import { LayerSelectComponent } from './layer-select/layer-select';

export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({ declarations: [
        AppComponent,
        MapComponent,
        AppDirective,
        FilesManipulationComponent,
        LayerSelectComponent
    ],
    bootstrap: [AppComponent], imports: [CommonModule,
        BrowserModule,
        MatIconModule,
        FormsModule,
        TranslateModule.forRoot({
            defaultLanguage: 'cz',
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient]
            }
        })], providers: [provideHttpClient(withInterceptorsFromDi())] })
export class AppModule { }