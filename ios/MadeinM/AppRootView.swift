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
                Label("Catalogo", systemImage: "leaf")
            }

            NavigationStack {
                ScanPrototypeView(service: service)
            }
            .tabItem {
                Label("Escanear", systemImage: "camera.viewfinder")
            }
        }
        .tint(Color("BrandGreen"))
    }
}

private struct CatalogView: View {
    let service: MadeinMService
    @State private var products: [ProductSummary] = []
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        Group {
            if isLoading && products.isEmpty {
                ProgressView("Cargando productos...")
            } else if let errorMessage {
                ContentUnavailableView("No pudimos cargar el catalogo", systemImage: "exclamationmark.triangle", description: Text(errorMessage))
            } else {
                List(products) { product in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(product.name)
                            .font(.headline)

                        Text(product.originStatusLabel)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.red)

                        HStack {
                            Text(product.confidenceLabel)
                            Spacer()
                            Text(product.caloriesLabel)
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Catalogo piloto")
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
            products = try await service.fetchProducts()
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

                    Text("Toma una foto o elige una imagen en el simulador.")
                        .font(.largeTitle.bold())

                    Text("Esta primera version nativa ya te deja probar el flujo visual de seleccion de imagen y confirmacion de producto desde SwiftUI. La integracion completa de autenticacion y carga segura sera el siguiente paso.")
                        .foregroundStyle(.secondary)
                }

                PhotosPicker(selection: $selectedItem, matching: .images) {
                    Label("Elegir foto", systemImage: "photo.on.rectangle")
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
                            Text("La vista previa de tu foto aparecera aqui.")
                                .foregroundStyle(.secondary)
                        }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Pista del producto")
                        .font(.headline)

                    TextField("Ejemplo: mango, aguacate, limon", text: $observedHint)
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

                    Text("Producto del catalogo")
                        .font(.headline)

                    if isLoadingProducts {
                        ProgressView("Cargando coincidencias...")
                    } else {
                        Picker("Producto", selection: $selectedProductID) {
                            Text("Selecciona un producto").tag(Optional<UUID>.none)
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
                    Text("Confirmar coincidencia")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color("BrandGreen"))
                .disabled(matchedProduct == nil)

                if let matchedProduct {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Resultado actual")
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
                    Text("Confirmaciones recientes")
                        .font(.headline)

                    if confirmedMatches.isEmpty {
                        Text("Tus confirmaciones locales apareceran aqui mientras seguimos construyendo la parte conectada al backend.")
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
        .navigationTitle("Escanear")
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
                statusMessage = "Imagen cargada en el prototipo iOS. Elige el producto correcto y confirma la coincidencia."
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

        statusMessage = "Coincidencia confirmada localmente para \(matchedProduct.name)."
        confirmedMatches.insert(
            ConfirmedMatch(id: UUID(), product: matchedProduct, timestamp: Date()),
            at: 0
        )
    }
}

private struct ConfirmedMatch: Identifiable {
    let id: UUID
    let product: ProductSummary
    let timestamp: Date
}
