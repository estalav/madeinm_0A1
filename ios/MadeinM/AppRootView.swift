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
                List(products) { product in
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
                                Text(product.origin.stateName ?? "State pending")
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
                    OriginChip(text: product.origin.stateName ?? "State pending")
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

                    Text(product.origin.summaryReason ?? "No origin explanation recorded yet.")
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
    @State private var confirmedMatches: [ConfirmedMatch] = []
    @State private var products: [ProductSummary] = []
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: Image?
    @State private var selectedProductID: UUID?
    @State private var observedHint = ""
    @State private var isLoadingProducts = false
    @State private var errorMessage: String?
    @State private var statusMessage: String?

    var matchedProduct: ProductSummary? {
        products.first(where: { $0.id == selectedProductID })
    }

    var suggestedProducts: [ProductSummary] {
        service.suggestProducts(query: observedHint, from: products)
    }

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

                    Text("This native pilot lets you test the visual scan flow, confirm a product, and browse the same catalog and origin language used on the web app.")
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
                    Text("Product hint")
                        .font(.headline)

                    TextField("Example: mango, avocado, lime", text: $observedHint)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding()
                        .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))

                    if !suggestedProducts.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 10) {
                                ForEach(suggestedProducts.prefix(4)) { product in
                                    Button {
                                        selectedProductID = product.id
                                    } label: {
                                        Text(product.name)
                                            .padding(.horizontal, 14)
                                            .padding(.vertical, 10)
                                    }
                                    .buttonStyle(.bordered)
                                    .tint(Color("BrandGreen"))
                                }
                            }
                        }
                    }

                    Text("Catalog product")
                        .font(.headline)

                    if isLoadingProducts {
                        ProgressView("Loading matches...")
                    } else {
                        Picker("Product", selection: $selectedProductID) {
                            Text("Select a product").tag(Optional<UUID>.none)
                            ForEach(products) { product in
                                Text(product.name).tag(Optional(product.id))
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                }

                Button {
                    confirmCurrentMatch()
                } label: {
                    Text("Confirm match")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color("BrandGreen"))
                .disabled(matchedProduct == nil)

                if let matchedProduct {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Current result")
                            .font(.caption.weight(.bold))
                            .textCase(.uppercase)
                            .foregroundStyle(Color("BrandRed"))

                        Text(matchedProduct.name)
                            .font(.title.bold())

                        Text(matchedProduct.originStatusLabel)
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(Color("BrandRed"))

                        Text(matchedProduct.confidenceLabel)
                            .font(.headline)
                            .foregroundStyle(Color("BrandGreen"))

                        Text(matchedProduct.caloriesLabel)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
                }

                if let statusMessage {
                    Text(statusMessage)
                        .foregroundStyle(Color("BrandGreen"))
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.white.opacity(0.8), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Recent confirmations")
                        .font(.headline)

                    if confirmedMatches.isEmpty {
                        Text("Your local confirmations will appear here while we keep building the backend-connected scan flow.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(confirmedMatches) { match in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(match.product.name)
                                    .font(.headline)

                                Text(match.product.originStatusLabel)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Color("BrandRed"))

                                Text(match.timestamp.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
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
            if selectedProductID == nil {
                selectedProductID = products.first?.id
            }
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
                selectedImage = Image(uiImage: uiImage)
                statusMessage = "Image loaded in the iOS prototype. Choose the right product and confirm the match."
                if observedHint.isEmpty {
                    observedHint = "mango"
                }
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func confirmCurrentMatch() {
        guard let matchedProduct else { return }

        statusMessage = "Match confirmed locally for \(matchedProduct.name)."
        confirmedMatches.insert(
            ConfirmedMatch(id: UUID(), product: matchedProduct, timestamp: Date()),
            at: 0
        )
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

private struct ConfirmedMatch: Identifiable {
    let id: UUID
    let product: ProductSummary
    let timestamp: Date
}
