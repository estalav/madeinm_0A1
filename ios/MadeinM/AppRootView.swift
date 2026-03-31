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
    @State private var products: [ProductSummary] = []
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: Image?
    @State private var selectedProductID: UUID?
    @State private var isLoadingProducts = false
    @State private var errorMessage: String?

    var matchedProduct: ProductSummary? {
        products.first(where: { $0.id == selectedProductID })
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
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
