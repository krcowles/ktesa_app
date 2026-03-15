/**
 * The options for configuring a watcher that listens for location updates.
 */
export interface WatcherOptions {
    /**
     * If the "backgroundMessage" option is defined, the watcher will
     * provide location updates whether the app is in the background or the
     * foreground. If it is not defined, location updates are only
     * guaranteed in the foreground. This is true on both platforms.
     * 
     * On Android, a notification must be shown to continue receiving
     * location updates in the background. This option specifies the text of
     * that notification.
     */
    backgroundMessage?: string;
    /**
     * The title of the notification mentioned above.
     * @default "Using your location"
     */
    backgroundTitle?: string;
    /**
     * Whether permissions should be requested from the user automatically,
     * if they are not already granted.
     * @default true
     */
    requestPermissions?: boolean;
    /**
     * If "true", stale locations may be delivered while the device
     * obtains a GPS fix. You are responsible for checking the "time"
     * property. If "false", locations are guaranteed to be up to date.
     * @default false
     */
    stale?: boolean;
    /**
     * The distance in meters that the device must move before a new location update is triggered.
     * This is used to filter out small movements and reduce the number of updates.
     * @default 0
     */
    distanceFilter?: number;
}

/**
 * Represents a geographical location with various attributes.
 */
export interface Location {
    latitude: number;
    longitude: number;
    /**
     * Radius of horizontal uncertainty in metres, with 68% confidence.
     */
    accuracy: number;
    /**
     * Metres above sea level (or null).
     */
    altitude: number | null;
    altitudeAccuracy: number | null;
    simulated: boolean;
    bearing: number | null;
    speed: number | null;
    time: number | null;
}

export interface CallbackError extends Error {
    code?: string;
}

export interface BackgroundGeolocationPlugin {
    addWatcher(
        options: WatcherOptions,
        callback: (
            position?: Location,
            error?: CallbackError
        ) => void
    ): Promise<string>;
    /**
     * Removes a watcher by its unique identifier.
     * @param options the options for removing the watcher
     * @returns a promise that resolves when the watcher is successfully removed
     */
    removeWatcher(options: {
        id: string
    }): Promise<void>;
    /**
     * Opens the settings page of the app.
     */
    openSettings(): Promise<void>;
}
