import {App, MarkdownView, Plugin, TFile, WorkspaceWindow, View} from 'obsidian';

export default class RawImageMouseWheelZoomPlugin extends Plugin {
    isKeyHeldDown = false;

    async onload() {
        this.registerEvent(
            this.app.workspace.on("window-open", (newWindow: WorkspaceWindow) => this.registerEvents(newWindow.win))
        );
        this.registerEvents(window);

        console.log("Loaded: Raw Image Mousewheel image zoom")
    }

    /**
     * When the config key is released, we enable the scroll again and reset the key held down flag.
     */
    onConfigKeyUp(currentWindow: Window) {
        this.isKeyHeldDown = false;
        this.enableScroll(currentWindow);
    }

    onunload(currentWindow: Window = window) {
        // Re-enable the normal scrolling behavior when the plugin unloads
        this.enableScroll(currentWindow);
    }

     /**
     * Registers image resizing events for the specified window
     * @param currentWindow window in which to register events
     * @private
     */
    private registerEvents(currentWindow: Window) {
        const doc: Document = currentWindow.document;
        this.registerDomEvent(doc, "keydown", (evt) => {
            if (evt.code === "AltLeft") {
                this.isKeyHeldDown = true;
            }
        });
        this.registerDomEvent(doc, "keyup", (evt) => {
            if (evt.code === "AltLeft") {
                this.onConfigKeyUp(currentWindow);
            }
        });
        this.registerDomEvent(doc, "wheel", (evt) => {
            if (this.isKeyHeldDown) {
                // When for example using Alt + Tab to switch between windows, the key is still recognized as held down.
                // We check if the key is really held down by checking if the key is still pressed in the event when the
                // wheel event is triggered.
                if (!evt.altKey) {
                    this.onConfigKeyUp(currentWindow);
                    return;
                }

                const eventTarget = evt.target as Element;
                
                const targetIsCanvas: boolean = eventTarget.hasClass("canvas-node-content-blocker")
                const targetIsCanvasNode: boolean = eventTarget.closest(".canvas-node-content") !== null;
                const targetIsImage: boolean = eventTarget.nodeName === "IMG";

                if (targetIsCanvas || targetIsCanvasNode || targetIsImage) {
                    this.disableScroll(currentWindow);
                }

                if (targetIsCanvas || targetIsCanvasNode) {
                    // we trying to resize focused canvas node.
                    // i think here can be implementation of zoom images in embded markdown files on canvas. 
                }
                else if (targetIsImage) {
                    // Handle the zooming of the image
                    this.handleZoom(evt, eventTarget);
                }
            }
        });
    }

    /**
     * Handles zooming with the mousewheel on an image
     * @param evt wheel event
     * @param eventTarget targeted image element
     * @private
     */
    private async handleZoom(evt: WheelEvent, eventTarget: Element) {
        const imageUri = eventTarget.attributes.getNamedItem("src").textContent;

		if (imageUri == null ||  !imageUri.contains("data:image/png"))
			return;

		const activeFile: TFile = await this.getActivePaneWithImage(eventTarget);

		let fileText = await this.app.vault.read(activeFile)
		const originalFileText = fileText;

		var origWidth = RawImageMouseWheelZoomPlugin.getImageWidth(imageUri);

        const image = eventTarget as HTMLImageElement;

		const currWidth = image.width;

		var newWidth = origWidth;
		var currText = "![](" + imageUri + ")";
        var power = 0;

		if (!fileText.contains(currText)) {
			newWidth = currWidth;
			currText = "![|" + currWidth + "](" + imageUri + ")";
            power = Math.floor(Math.log(currWidth / origWidth) / Math.log(1.05) + 0.5);
        }

        if (evt.deltaY < 0) {
            power++;
        }
        else if (newWidth > 25) {
            power--;
        }

        var newText = "![|" + Math.floor(Math.pow(1.05, power) * origWidth) + "](" + imageUri + ")";

		fileText = fileText.replace(currText, newText);

		await this.app.vault.modify(activeFile, fileText)
    }

	private static getImageWidth(imageUri: string) : number {
		const substringIndex = imageUri.indexOf("iVBOR");					// find index of start of data
		const subString64 = imageUri.substring(substringIndex + 21, substringIndex + 28);	// grab only required chars
		var decodedString = atob(subString64);								// decode from base64
		var width = (decodedString.charCodeAt(0) & 63) << 26;				// data misalligned so mask with 00111111 to ignore first two bits
		width += decodedString.charCodeAt(1) << 18;
		width += decodedString.charCodeAt(2) << 10;
		width += decodedString.charCodeAt(3) << 2;
		width += (decodedString.charCodeAt(4) & 192) >> 6;					// mask with 11111100 to ignore last two bits
		return width;
	}


    /**
     * Loop through all panes and get the pane that hosts a markdown file with the image to zoom
     * @param imageElement The HTML Element of the image
     * @private
     */
    private async getActivePaneWithImage(imageElement: Element): Promise<TFile> {
        return new Promise(((resolve, reject) => {
            this.app.workspace.iterateAllLeaves(leaf => {
                if (leaf.view.containerEl.contains(imageElement) && leaf.view instanceof MarkdownView) {
                    resolve(leaf.view.file);
                }
            })

            reject(new Error("No file belonging to the image found"))
        }))
    }

    // Utilities to disable and enable scrolling //


    preventDefault(ev: WheelEvent) {
        ev.preventDefault();
    }

    wheelOpt: AddEventListenerOptions = {passive: false, capture: true }
    wheelEvent = 'wheel' as keyof WindowEventMap;

    /**
     * Disables the normal scroll event
     */
    disableScroll(currentWindow: Window) {
        currentWindow.addEventListener(this.wheelEvent, this.preventDefault, this.wheelOpt);
    }
 
    /**
     * Enables the normal scroll event
     */
    enableScroll(currentWindow: Window) {
        currentWindow.removeEventListener(this.wheelEvent, this.preventDefault, this.wheelOpt);
    }
}