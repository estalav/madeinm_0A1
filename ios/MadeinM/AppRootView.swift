import MapKit
import PhotosUI
import SwiftUI

struct AppRootView: View {
    let service: MadeinMService

    var body: some View {
        TabView {
            NavigationStack {
                CatalogView(service: service)
            }
            .tabItem {
                Label("Catalog", systemImage: "square.grid.2x2")
            }

            NavigationStack {
                OriginsMapView(service: service)
            }
            .tabItem {
                Label("Origins", systemImage: "map")
            }

            NavigationStack {
                ScanPrototypeView(service: service)
            }
            .tabItem {
                Label("Scan", systemImage: "camera.viewfinder")
            }
        }
        .tint(Color("BrandGreen"))
    }
}

private struct CatalogView: View {
    let service: MadeinMService
    @State private var products: [CatalogProduct] = []
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        Group {
            if isLoading && products.isEmpty {
                ProgressView("Loading catalog...")
            } else if let errorMessage {
                ContentUnavailableView("We could not load the catalog", systemImage: "exclamationmark.triangle", description: Text(errorMessage))
            } else {
                List(products, id: \.id) { product in
                    NavigationLink {
                        CatalogProductDetailView(product: product)
                    } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(product.name)
                                .font(.headline)

                            Text(product.originStatusLabel)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(Color("BrandRed"))

                            HStack {
                                Text(product.confidenceLabel)
                                Spacer()
                                Text(product.origin.state_name ?? "State pending")
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Catalog")
        .task {
            await loadProducts()
        }
        .refreshable {
            await loadProducts()
        }
    }

    private func loadProducts() async {
        isLoading = true
        errorMessage = nil

        do {
            products = try await service.fetchCatalogProducts()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

private struct CatalogProductDetailView: View {
    let product: CatalogProduct

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if product.referenceImages.isEmpty {
                    RoundedRectangle(cornerRadius: 26, style: .continuous)
                        .fill(Color("BrandSand").opacity(0.14))
                        .frame(height: 220)
                        .overlay {
                            VStack(spacing: 10) {
                                Image(systemName: "photo")
                                    .font(.title2)
                                Text("No reference photos yet")
                                    .font(.headline)
                                Text("This product still needs curated images to strengthen recognition.")
                                    .foregroundStyle(.secondary)
                                    .multilineTextAlignment(.center)
                                    .padding(.horizontal, 24)
                            }
                        }
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 14) {
                            ForEach(product.referenceImages) { image in
                                AsyncImage(url: image.url) { phase in
                                    switch phase {
                                    case .success(let loadedImage):
                                        loadedImage
                                            .resizable()
                                            .scaledToFill()
                                    case .failure:
                                        Color("BrandSand").opacity(0.14)
                                            .overlay {
                                                Image(systemName: "photo")
                                                    .foregroundStyle(.secondary)
                                            }
                                    case .empty:
                                        ProgressView()
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                                .frame(width: 240, height: 220)
                                .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                                .overlay(alignment: .bottomLeading) {
                                    Text(image.sourceLabel)
                                        .font(.caption.weight(.semibold))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(.ultraThinMaterial, in: Capsule())
                                        .padding(12)
                                }
                            }
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text(product.name)
                        .font(.largeTitle.bold())

                    Text(product.originStatusLabel)
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(Color("BrandRed"))

                    Text(product.confidenceLabel)
                        .font(.headline)
                        .foregroundStyle(Color("BrandGreen"))

                    Text(product.descriptionText)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    OriginChip(text: product.category.capitalized)
                    OriginChip(text: product.subcategory?.capitalized ?? "No subcategory")
                    OriginChip(text: product.origin.state_name ?? "State pending")
                }

                if !product.aliases.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Aliases")
                            .font(.headline)

                        FlowingAliasView(aliases: product.aliases)
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("Origin reasoning")
                        .font(.headline)

                    Text(product.origin.summary_reason ?? "No origin explanation recorded yet.")
                        .foregroundStyle(.secondary)
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
            }
            .padding(20)
        }
        .background(
            LinearGradient(
                colors: [Color("BrandSand").opacity(0.18), .white, Color("BrandGreen").opacity(0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .navigationTitle("Product")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct OriginsMapView: View {
    let service: MadeinMService
    @State private var products: [CatalogProduct] = []
    @State private var errorMessage: String?
    @State private var isLoading = false
    @State private var position = MapCameraPosition.region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 22.4, longitude: -102.0),
            span: MKCoordinateSpan(latitudeDelta: 22, longitudeDelta: 20)
        )
    )

    var mappedOrigins: [OriginPoint] {
        service.originPoints(from: products)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Origin map")
                        .font(.largeTitle.bold())

                    Text("See where the active catalog currently traces origin across Mexico. Products without a verified state stay out of the map until they are curated.")
                        .foregroundStyle(.secondary)
                }

                if isLoading && products.isEmpty {
                    ProgressView("Loading mapped origins...")
                        .frame(maxWidth: .infinity, minHeight: 220)
                } else if let errorMessage {
                    ContentUnavailableView("We could not load the origin map", systemImage: "map", description: Text(errorMessage))
                } else {
                    Map(position: $position) {
                        ForEach(mappedOrigins) { point in
                            Annotation(point.title, coordinate: point.coordinate) {
                                VStack(spacing: 6) {
                                    Text("\(point.count)")
                                        .font(.caption.bold())
                                        .foregroundStyle(.white)
                                        .frame(width: 28, height: 28)
                                        .background(Color("BrandRed"), in: Circle())

                                    Text(point.shortLabel)
                                        .font(.caption2.weight(.semibold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(.ultraThinMaterial, in: Capsule())
                                }
                            }
                        }
                    }
                    .frame(height: 320)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Mapped states")
                            .font(.headline)

                        ForEach(mappedOrigins) { point in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(point.title)
                                        .font(.headline)
                                    Spacer()
                                    Text("\(point.count) product\(point.count == 1 ? "" : "s")")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Text(point.products.joined(separator: ", "))
                                    .foregroundStyle(.secondary)
                            }
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        }
                    }
                }
            }
            .padding(20)
        }
        .background(
            LinearGradient(
                colors: [Color("BrandSand").opacity(0.18), .white, Color("BrandGreen").opacity(0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .navigationTitle("Origins")
        .task {
            await loadProducts()
        }
        .refreshable {
            await loadProducts()
        }
    }

    private func loadProducts() async {
        isLoading = true
        errorMessage = nil

        do {
            products = try await service.fetchCatalogProducts()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

private struct ScanPrototypeView: View {
    let service: MadeinMService
    struct ItemCorrectionState {
        var mode: CorrectionMode = .catalog
        var selectedProductId: UUID?
        var typedName: String = ""
        var appliedLabel: String?
    }

    enum CorrectionMode: String, CaseIterable, Identifiable {
        case catalog
        case draft

        var id: String { rawValue }

        var label: String {
            switch self {
            case .catalog:
                return "Pick catalog product"
            case .draft:
                return "Type correct product"
            }
        }
    }

    @State private var products: [ProductSummary] = []
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: Image?
    @State private var selectedUIImage: UIImage?
    @State private var barcodeValue = ""
    @State private var marketContext = ""
    @State private var vendorOriginHint = ""
    @State private var observedTextHint = ""
    @State private var ocrDetectedText: [String] = []
    @State private var recognizedItems: [RecognizedItem] = []
    @State private var correctionStates: [String: ItemCorrectionState] = [:]
    @State private var correctionOpenItemIDs: Set<String> = []
    @State private var correctionMessages: [String: String] = [:]
    @State private var correctionErrors: [String: String] = [:]
    @State private var creatingDraftItemIDs: Set<String> = []
    @State private var isLoadingProducts = false
    @State private var isRecognizing = false
    @State private var errorMessage: String?
    @State private var statusMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Escaneo iOS")
                        .font(.caption.weight(.bold))
                        .textCase(.uppercase)
                        .foregroundStyle(Color("BrandRed"))

                    Text("Take a photo or choose one in the simulator.")
                        .font(.largeTitle.bold())

                    Text("Use one photo to detect multiple grocery items, then review product and origin evidence the same way the web app does.")
                        .foregroundStyle(.secondary)
                }

                PhotosPicker(selection: $selectedItem, matching: .images) {
                    Label("Choose photo", systemImage: "photo.on.rectangle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color("BrandGreen"))
                .onChange(of: selectedItem) { _, newItem in
                    Task {
                        await loadImage(from: newItem)
                    }
                }

                if let selectedImage {
                    selectedImage
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 240)
                        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
                        .overlay {
                            RoundedRectangle(cornerRadius: 24, style: .continuous)
                                .stroke(Color("BrandGreen").opacity(0.18), lineWidth: 1)
                        }
                } else {
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(Color("BrandSand").opacity(0.15))
                        .frame(height: 240)
                        .overlay {
                            Text("Your photo preview will appear here.")
                                .foregroundStyle(.secondary)
                        }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Barcode (optional)")
                        .font(.headline)

                    TextField("Example: 7501234567890 or 4011", text: $barcodeValue)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding()
                        .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                    Text("Market context")
                        .font(.headline)

                    TextField("Example: Central de Abasto CDMX", text: $marketContext)
                        .textInputAutocapitalization(.words)
                        .padding()
                        .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                    Text("Seller or origin hint")
                        .font(.headline)

                    TextField("Example: seller says Puebla or producto de Mexico", text: $vendorOriginHint)
                        .textInputAutocapitalization(.sentences)
                        .padding()
                        .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                    Text("Visible text from sign, box, or label")
                        .font(.headline)

                    TextField("Example: Producto de Mexico, Chiapas, supplier name", text: $observedTextHint, axis: .vertical)
                        .textInputAutocapitalization(.sentences)
                        .lineLimit(3 ... 5)
                        .padding()
                        .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }

                Button {
                    Task {
                        await runRecognition()
                    }
                } label: {
                    Text(isRecognizing ? "Analyzing..." : "Recognize products")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color("BrandGreen"))
                .disabled(selectedUIImage == nil || isRecognizing || isLoadingProducts)

                if let statusMessage {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Recognition status")
                            .font(.caption.weight(.bold))
                            .textCase(.uppercase)
                            .foregroundStyle(Color("BrandRed"))

                        Text(statusMessage)
                            .foregroundStyle(Color("BrandGreen"))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                }

                if !ocrDetectedText.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("OCR evidence")
                            .font(.headline)

                        FlowingAliasView(aliases: ocrDetectedText)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Detected items")
                        .font(.headline)

                    if recognizedItems.isEmpty {
                        Text("Choose a photo and run recognition to see each detected grocery item from the image.")
                            .foregroundStyle(.secondary)
                    } else {
                        HStack {
                            let matchedCount = recognizedItems.filter { $0.suggestedProductId != nil }.count
                            let unmatchedCount = recognizedItems.count - matchedCount
                            OriginChip(text: "\(recognizedItems.count) items")
                            OriginChip(text: "\(matchedCount) matched")
                            OriginChip(text: "\(unmatchedCount) need review")
                        }

                        ForEach(Array(recognizedItems.enumerated()), id: \.offset) { index, item in
                            let matchedProduct = products.first(where: { $0.id == item.suggestedProductId })
                            let itemID = item.id
                            let correction = correctionStates[itemID] ?? ItemCorrectionState(
                                mode: .catalog,
                                selectedProductId: item.suggestedProductId,
                                typedName: item.visualGuess ?? "",
                                appliedLabel: nil
                            )

                            VStack(alignment: .leading, spacing: 10) {
                                Text("Item \(index + 1)")
                                    .font(.caption.weight(.bold))
                                    .textCase(.uppercase)
                                    .foregroundStyle(Color("BrandRed"))

                                Text(matchedProduct?.name ?? item.visualGuess ?? "Unknown item")
                                    .font(.title3.bold())

                                Text(matchedProduct != nil ? "Matched inside the pilot catalog" : "Outside the pilot catalog")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Color("BrandRed"))

                                Text("Confidence \(item.confidence)")
                                    .font(.headline)
                                    .foregroundStyle(Color("BrandGreen"))

                                Text(item.originAssessmentLabel)
                                    .font(.subheadline.weight(.semibold))

                                Text(item.originExplanation)
                                    .foregroundStyle(.secondary)

                                if !item.detectedText.isEmpty {
                                    FlowingAliasView(aliases: item.detectedText)
                                }

                                Text(item.reasoning)
                                    .foregroundStyle(.secondary)

                                if !item.evidenceNeeded.isEmpty {
                                    FlowingAliasView(aliases: item.evidenceNeeded)
                                }

                                Button {
                                    toggleCorrection(for: item)
                                } label: {
                                    Text(correctionOpenItemIDs.contains(itemID) ? "Close correction" : "Is this correct?")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.bordered)
                                .tint(Color("BrandGreen"))

                                if correctionOpenItemIDs.contains(itemID) {
                                    VStack(alignment: .leading, spacing: 12) {
                                        Picker("Correction mode", selection: Binding(
                                            get: { correction.mode },
                                            set: { newMode in
                                                updateCorrectionState(for: itemID) { state in
                                                    state.mode = newMode
                                                }
                                            }
                                        )) {
                                            ForEach(CorrectionMode.allCases) { mode in
                                                Text(mode.label).tag(mode)
                                            }
                                        }
                                        .pickerStyle(.segmented)

                                        if correction.mode == .catalog {
                                            Picker("Catalog product", selection: Binding(
                                                get: { correction.selectedProductId },
                                                set: { newValue in
                                                    updateCorrectionState(for: itemID) { state in
                                                        state.selectedProductId = newValue
                                                    }
                                                }
                                            )) {
                                                Text("Choose a product").tag(Optional<UUID>.none)
                                                ForEach(products) { product in
                                                    Text("\(product.name) · \(product.category)").tag(Optional(product.id))
                                                }
                                            }
                                            .pickerStyle(.menu)

                                            Button {
                                                applyCatalogCorrection(for: item)
                                            } label: {
                                                Text("Apply correction")
                                                    .frame(maxWidth: .infinity)
                                            }
                                            .buttonStyle(.bordered)
                                            .tint(Color("BrandGreen"))
                                        } else {
                                            TextField("Example: Papa blanca", text: Binding(
                                                get: { correction.typedName },
                                                set: { newValue in
                                                    updateCorrectionState(for: itemID) { state in
                                                        state.typedName = newValue
                                                    }
                                                }
                                            ))
                                            .textInputAutocapitalization(.words)
                                            .padding()
                                            .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                                            Button {
                                                Task {
                                                    await createCorrectedDraft(for: item)
                                                }
                                            } label: {
                                                Text(creatingDraftItemIDs.contains(itemID) ? "Saving..." : "Create corrected draft")
                                                    .frame(maxWidth: .infinity)
                                            }
                                            .buttonStyle(.bordered)
                                            .tint(Color("BrandGreen"))
                                            .disabled(creatingDraftItemIDs.contains(itemID))
                                        }

                                        if let appliedLabel = correction.appliedLabel {
                                            Text("Current correction: \(appliedLabel)")
                                                .foregroundStyle(Color("BrandGreen"))
                                        }

                                        if let message = correctionMessages[itemID] {
                                            Text(message)
                                                .foregroundStyle(Color("BrandGreen"))
                                        }

                                        if let error = correctionErrors[itemID] {
                                            Text(error)
                                                .foregroundStyle(.red)
                                        }
                                    }
                                    .padding(.top, 6)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(16)
                            .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        }
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }
            .padding(20)
        }
        .background(
            LinearGradient(
                colors: [Color("BrandSand").opacity(0.18), .white, Color("BrandGreen").opacity(0.12)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .navigationTitle("Scan")
        .task {
            await loadProducts()
        }
    }

    private func loadProducts() async {
        guard products.isEmpty else { return }

        isLoadingProducts = true
        errorMessage = nil

        do {
            products = try await service.fetchProducts()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoadingProducts = false
    }

    @MainActor
    private func loadImage(from item: PhotosPickerItem?) async {
        guard let item else { return }

        do {
            if let data = try await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                selectedUIImage = uiImage
                selectedImage = Image(uiImage: uiImage)
                statusMessage = "Image loaded. Run recognition to detect multiple products in the photo."
                recognizedItems = []
                ocrDetectedText = []
                correctionStates = [:]
                correctionOpenItemIDs = []
                correctionMessages = [:]
                correctionErrors = [:]
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runRecognition() async {
        guard let selectedUIImage else {
            errorMessage = "Choose a photo before running recognition."
            return
        }

        isRecognizing = true
        errorMessage = nil
        statusMessage = nil

        do {
            let payload = try await service.recognizeProducts(
                image: selectedUIImage,
                candidates: products,
                barcodeValue: barcodeValue,
                marketContext: marketContext,
                vendorOriginHint: vendorOriginHint,
                observedTextHint: observedTextHint
            )

            recognizedItems = payload.items
            ocrDetectedText = payload.detectedText
            correctionStates = Dictionary(uniqueKeysWithValues: payload.items.map { item in
                (
                    item.id,
                    ItemCorrectionState(
                        mode: .catalog,
                        selectedProductId: item.suggestedProductId,
                        typedName: item.visualGuess ?? "",
                        appliedLabel: nil
                    )
                )
            })
            correctionOpenItemIDs = []
            correctionMessages = [:]
            correctionErrors = [:]
            statusMessage = payload.items.isEmpty
                ? "No products were recognized confidently from this photo."
                : "Detected \(payload.items.count) product\(payload.items.count == 1 ? "" : "s") from this image."
        } catch {
            errorMessage = error.localizedDescription
        }

        isRecognizing = false
    }

    private func toggleCorrection(for item: RecognizedItem) {
        if correctionOpenItemIDs.contains(item.id) {
            correctionOpenItemIDs.remove(item.id)
        } else {
            correctionOpenItemIDs.insert(item.id)
        }
    }

    private func updateCorrectionState(for itemID: String, mutate: (inout ItemCorrectionState) -> Void) {
        var state = correctionStates[itemID] ?? ItemCorrectionState()
        mutate(&state)
        correctionStates[itemID] = state
    }

    private func applyCatalogCorrection(for item: RecognizedItem) {
        let itemID = item.id
        guard let selectedProductId = correctionStates[itemID]?.selectedProductId,
              let selectedProduct = products.first(where: { $0.id == selectedProductId }) else {
            correctionErrors[itemID] = "Choose the correct catalog product first."
            return
        }

        if let index = recognizedItems.firstIndex(where: { $0.id == itemID }) {
            recognizedItems[index] = RecognizedItem(
                suggestedProductId: selectedProduct.id,
                confidence: item.confidence,
                reasoning: item.reasoning,
                visualGuess: item.visualGuess,
                detectedText: item.detectedText,
                originAssessment: item.originAssessment,
                originExplanation: item.originExplanation,
                evidenceNeeded: item.evidenceNeeded,
                draftProduct: item.draftProduct
            )
        }

        correctionErrors[itemID] = nil
        correctionMessages[itemID] = "Marked as corrected: \(selectedProduct.name)."
        updateCorrectionState(for: itemID) { state in
            state.appliedLabel = selectedProduct.name
        }
        correctionOpenItemIDs.remove(itemID)
    }

    private func createCorrectedDraft(for item: RecognizedItem) async {
        let itemID = item.id
        let correctedName = correctionStates[itemID]?.typedName.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        guard !correctedName.isEmpty else {
            correctionErrors[itemID] = "Type the correct product name first."
            return
        }

        creatingDraftItemIDs.insert(itemID)
        correctionErrors[itemID] = nil

        do {
            let payload = try await service.createDraftProduct(
                name: correctedName,
                category: item.draftProduct?.category ?? "produce",
                subcategory: item.draftProduct?.subcategory,
                aliases: Array(
                    Set(
                        [correctedName] +
                        (item.draftProduct?.aliases ?? []) +
                        (item.visualGuess.map { [$0] } ?? [])
                    )
                ),
                barcodeValue: barcodeValue,
                reasoning: item.reasoning,
                visualGuess: correctedName
            )

            let label = payload.name ?? correctedName
            correctionMessages[itemID] = payload.existing == true
                ? "A matching product already exists: \(label) (\(payload.status ?? "active"))."
                : "Draft product created successfully: \(label) (\(payload.status ?? "draft"))."
            updateCorrectionState(for: itemID) { state in
                state.appliedLabel = label
            }
            correctionOpenItemIDs.remove(itemID)
        } catch {
            correctionErrors[itemID] = error.localizedDescription
        }

        creatingDraftItemIDs.remove(itemID)
    }
}

private struct OriginChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.subheadline.weight(.medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(.white.opacity(0.82), in: Capsule())
    }
}

private struct FlowingAliasView: View {
    let aliases: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(chunkedAliases, id: \.self) { row in
                HStack(spacing: 10) {
                    ForEach(row, id: \.self) { alias in
                        Text(alias)
                            .font(.subheadline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color("BrandSand").opacity(0.14), in: Capsule())
                    }
                }
            }
        }
    }

    private var chunkedAliases: [[String]] {
        stride(from: 0, to: aliases.count, by: 3).map { start in
            Array(aliases[start ..< min(start + 3, aliases.count)])
        }
    }
}
