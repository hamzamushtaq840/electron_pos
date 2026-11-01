# Hamza POS

Offline Electron + React + SQLite point of sale for small retail and grocery stores. The application stores all operational data in the Electron `userData` directory and does not require an internet connection after installation.

## Requirements

- Node.js 20 LTS or newer
- Windows: Visual Studio Build Tools with the Desktop development with C++ workload (required by `better-sqlite3` if a prebuilt binary is unavailable)
- macOS/Linux: the platform's standard C/C++ build toolchain

## Install and run

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run dist
```

The Windows installer is written to `dist/`. `better-sqlite3`, `escpos`, and `escpos-usb` are bundled as native/runtime dependencies by Electron Builder.

## First launch

On the first launch, enter the fixed one-time setup PIN `827123`. The PIN field is masked. The Electron main process validates the PIN, creates all SQLite tables, and stores an initialization marker in the local database. The setup PIN is not requested again during normal operation because this build intentionally has no user roles or recurring login. Machine IDs, activation keys, and `keygen.js` are not used.

## Data and theme

The database is `pos_data.db` in the Electron `userData` directory. The theme is `theme.json` in the same directory and defaults to:

```json
{"primary":"#2E7D32","secondary":"#FFFFFF","background":"#F5F5F5"}
```

The Settings screen updates the store profile row and theme colors without rebuilding the app. The store profile is constrained to one row and includes company name, trade, address, phone, email, logo path, and receipt footer text.

## Hardware

The main process owns hardware access. The optional drawer action sends the exact ESC/POS kick bytes `1B 70 00 19 FA` (decimal `27 112 0 25 250`) through `escpos-usb`. Install the printer's Windows driver, connect the USB thermal printer, and verify it appears in Device Manager. For generic printers, identify VID/PID in Device Manager → Details → Hardware Ids. Select the matching USB printer in the eventual hardware settings implementation; HID barcode scanners normally behave as keyboards and send a fast SKU sequence ending in Enter.

HID barcode scanners emulate keyboard input, so the dashboard reports physical scanner detection conservatively. The Sale screen changes to ready only after it receives a barcode sequence ending in Enter. Hardware access can fail safely when no printer is attached; database checkout remains usable. Receipt payloads must always append:

```text
Developed by Hamza
```

before dispatching to an ESC/POS device.

## Operational modules

The app includes one-time activation, optimized Sale checkout with scanner buffering, search, cart quantity updates, Hold/Recall, age restriction alerts, checkout and Khata balances, dashboard totals, low-stock reporting, Products, Categories, Suppliers with payment entry, Customers/Khata with payment receipt, Transactions, refunds, and store/theme settings. The UI deliberately avoids CSS animations, transitions, box shadows, and broad state updates so it remains responsive on low-end hardware.

The current workspace UI is organized as a dark navigation rail with large touch-friendly inputs, searchable domain-specific CRUD pages, modal editing forms, supplier payable payments, customer Khata receipts, payment reports, dashboard hardware cards, a sales trend chart, low-stock monitoring, and a complete checkout result modal. Products use the Electron `save-product` handler so blank SKUs receive a unique generated barcode before saving.

Supplier balance semantics are: `current_balance` is the amount owed to the supplier. Receiving stock increases it only for the unpaid portion; recording a supplier payment reduces it, never below zero. Customer balance semantics are the inverse from the shop perspective: an underpaid Khata sale increases the customer balance and receiving a payment reduces it. These movements are visible in Reports.

Theme settings are stored in `theme.json`, applied immediately to CSS variables, and saved without rebuilding. The editable values are `primary`, `secondary`, and `background`; the receipt tag remains the required hardcoded `Developed by Hamza`.

The Sale screen now confirms each checkout in a lightweight modal. Every checkout receives a permanent unique receipt number such as `R-20261031-7F3A2C`; the number is stored with a unique database index and is never reused after voiding. From the modal the owner can print the receipt, open the drawer, or return to a new sale. The same receipt print action is available from Transactions. Printing builds the receipt in the Electron main process from the saved receipt, items, and store profile, then sends it through `escpos-usb`; if no compatible printer is attached, the screen remains usable and shows the printer error as a toast. The required `Developed by Hamza` footer is appended to every generated payload.

Success, warning, and printer/database errors use a global toast region rather than browser alert dialogs. The Dashboard includes a dependency-free seven-day sales bar chart and a low-stock watch panel, keeping the application offline and avoiding a charting-library bundle. Cash tendered, customer selection, and all checkout actions use explicit vertical field spacing for reliable barcode-counter operation.

On first activation, the app inserts demo data if the products table is empty: five grocery products, two suppliers, two customers, and a Groceries category. This makes Checkout and Stock In testable immediately. Demo products use SKUs `890100000001` through `890100000005` and can be edited or deleted from the management screens.

## Native dependency rebuild

If Electron reports a native module ABI mismatch after changing Electron versions:

```bash
npx electron-builder install-app-deps
npm run dist
```
