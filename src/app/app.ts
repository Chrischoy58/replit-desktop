import {
    ElectronWindow,
    handleExternalLink,
    promptYesNoSync,
    IPAD_USER_AGENT,
    errorMessage
} from '../common';
import { app, Cookie, ipcMain, session, MenuItem } from 'electron';
import { ThemeHandler } from './themeHandler/themeHandler';
import { DiscordHandler } from './discordHandler';
import { SettingHandler } from './settingHandler';
import contextMenu from 'electron-context-menu';
import { appMenuSetup } from './menu/appMenuSetup';

class App {
    public readonly mainWindow: ElectronWindow;
    public readonly themeHandler: ThemeHandler;
    public readonly discordHandler: DiscordHandler;
    protected windowArray: ElectronWindow[];
    private readonly settingsHandler: SettingHandler;

    constructor() {
        this.mainWindow = new ElectronWindow({
            height: 720,
            width: 1280
            //show: false
        });
        /*this.mainWindow.webContents.on(
            'new-window',
            (
                e: NewWindowEvent,
                url: string,
                frameName: string,
                disposition: string,
                options: BrowserWindowConstructorOptions
            ) => {
                console.log(disposition)
                e.preventDefault();
                const window: ElectronWindow = new ElectronWindow({
                    // @ts-ignore
                    webContents: options.webContents, // use existing webContents if provided
                    show: false
                });
                window.show();
                e.newGuest = window;
            }
        );*/
        this.settingsHandler = new SettingHandler();
        this.windowArray = [];
        this.discordHandler = new DiscordHandler(this.mainWindow);
        this.mainWindow.setBackgroundColor('#393c42');
        this.themeHandler = new ThemeHandler(this.settingsHandler);
        this.addWindow(this.mainWindow);
        if (!this.settingsHandler.has('enable-ace')) {
            this.settingsHandler.set('enable-ace', false);
        } // Init settings for ace editor
        app.applicationMenu = appMenuSetup(
            this,
            this.themeHandler,
            this.settingsHandler
        );
        //Set Up menu
    }

    toggleAce(menu?: MenuItem) {
        let userAgent: string;
        if (menu) {
            if (menu.checked == true) {
                this.settingsHandler.set('enable-ace', true);
                userAgent = IPAD_USER_AGENT;
            } else {
                this.settingsHandler.set('enable-ace', false);
                userAgent = app.userAgentFallback;
            }
        } else {
            userAgent = IPAD_USER_AGENT;
        }
        this.windowArray.forEach((window) => {
            window.webContents.userAgent = userAgent;
            window.reload();
        });
    }

    async clearCookies(oauthOnly: boolean) {
        if (!oauthOnly) {
            if (
                !promptYesNoSync(
                    'Are you sure you want to clear all cookies?',
                    'Confirm'
                )
            ) {
                return;
            }
        }
        const allCookies: Array<Cookie> = await session.defaultSession.cookies.get(
            {}
        );
        const cookiesToRemove: Array<Cookie> = [];
        for (let x = 0; x < allCookies.length; x++) {
            const cookie: Cookie = allCookies[x];
            if (oauthOnly) {
                if (!cookie.domain.includes('repl.it')) {
                    cookiesToRemove.push(cookie);
                }
            } else {
                cookiesToRemove.push(cookie);
            }
        }
        for (let x = 0; x < cookiesToRemove.length; x++) {
            const cookie: Cookie = cookiesToRemove[x];
            await session.defaultSession.cookies.remove(
                `https://${cookie.domain.charAt(0) === '.' ? 'www' : ''}${
                    cookie.domain
                }${cookie.path}`,
                cookie.name
            );
            session.defaultSession.flushStorageData();
        }
        if (!oauthOnly) {
            for (let x = 0; x < this.windowArray.length; x++) {
                this.windowArray[x].reload();
            }
        }
    }

    addWindow(window: ElectronWindow) {
        contextMenu({ window: window });
        this.windowArray.push(window);
        ipcMain.on('choose-theme', () => {
            window.reload();
        });
        window.webContents.on('will-navigate', (e, url) => {
            handleExternalLink(e, window, url);
            console.log(this.settingsHandler.get('enable-ace'));
            if (this.settingsHandler.get('enable-ace')) {
                this.toggleAce();
            }
        });
        window.webContents.on('did-stop-loading', () => {
            this.addTheme(window).then();
        });
        window.webContents.on('did-fail-load', (e, code, description) => {
            errorMessage(window, code, description);
        });
    }

    async addTheme(windowObj: ElectronWindow) {
        for (let i = 1; i <= 3; i++) {
            try {
                await windowObj.webContents.insertCSS(
                    this.themeHandler.getString()
                );

                console.log(`Theme Added for window attempt ${i}`);
                break;
            } catch (e) {
                console.error(`Error adding theme on window ${e} attempt ${i}`);
            }
        }
    }
}

export { App };
