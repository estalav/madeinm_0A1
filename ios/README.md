# MadeinM iOS

This folder contains a small native `SwiftUI` prototype for MadeinM.

## What it includes

- a `Catalogo` tab that fetches the public pilot products from Supabase
- an `Escanear` tab that lets you choose a photo in the simulator, manually confirm a product match, and keep a local history of confirmations
- brand colors and a basic mobile-first visual system

## Current scope

This iOS prototype is intentionally smaller than the web app. It is meant to validate:

- native mobile navigation
- product browsing from Supabase
- local photo selection in SwiftUI
- result presentation with trust labels

It does **not** yet include:

- Supabase email auth
- private storage uploads
- automatic barcode reading
- automatic product classification

## Open in Xcode

Open:

- `ios/MadeinM.xcodeproj`

Then run the `MadeinM` scheme in an iPhone simulator.

## Notes

- In this coding environment, CoreSimulator is not available, so the simulator run could not be fully verified here.
- The project itself is recognized by `xcodebuild`, and the remaining failure in this environment is caused by missing simulator runtime access rather than a missing scheme or broken project layout.
