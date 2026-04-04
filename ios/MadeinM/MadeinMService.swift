import CoreLocation
import Foundation
import UIKit

struct ProductSummary: Identifiable, Decodable, Hashable {
    let id: UUID
    let name: String
    let category: String
    let origin_status: String?
    let confidence_level: String?
    let calories: Int?

    var originStatusLabel: String {
        switch origin_status {
        case "hecho_en_mexico":
            "Hecho en Mexico"
        case "producido_en_mexico":
            "Producido en Mexico"
        case "empacado_en_mexico":
            "Empacado en Mexico"
        case "importado":
            "Importado"
        default:
            "Origen no confirmado"
        }
    }

    var confidenceLabel: String {
        switch confidence_level {
        case "verificado":
            "Verificado"
        case "alta":
            "Alta confianza"
        case "media":
            "Confianza media"
        case "baja":
            "Baja confianza"
        default:
            "Sin confianza"
        }
    }

    var caloriesLabel: String {
        if let calories {
            return "\(calories) kcal por 100 g"
        }

        return "Calorias por confirmar"
    }
}

struct ProductAlias: Decodable, Hashable {
    let alias: String
}

struct ProductImageReference: Decodable, Hashable, Identifiable {
    let image_url: String
    let is_primary: Bool?
    let source_type: String?

    var id: String { image_url }

    var url: URL? {
        URL(string: image_url)
    }

    var sourceLabel: String {
        if source_type == "default" {
            return "Default reference"
        }

        return source_type?.replacingOccurrences(of: "_", with: " ").capitalized ?? "Reference photo"
    }
}

struct ProductOrigin: Decodable, Hashable {
    let origin_status: String?
    let confidence_level: String?
    let summary_reason: String?
    let country_code: String?
    let state_name: String?
}

struct CatalogProduct: Identifiable, Decodable, Hashable {
    let id: UUID
    let name: String
    let category: String
    let subcategory: String?
    let brand_name: String?
    let description: String?
    let default_image_url: String?
    let product_aliases: [ProductAlias]?
    let product_images: [ProductImageReference]?
    let origins: [ProductOrigin]?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case category
        case subcategory
        case brand_name
        case description
        case default_image_url
        case product_aliases
        case product_images
        case origins
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        category = try container.decode(String.self, forKey: .category)
        subcategory = try container.decodeIfPresent(String.self, forKey: .subcategory)
        brand_name = try container.decodeIfPresent(String.self, forKey: .brand_name)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        default_image_url = try container.decodeIfPresent(String.self, forKey: .default_image_url)
        product_aliases = try container.decodeIfPresent([ProductAlias].self, forKey: .product_aliases)
        product_images = try container.decodeIfPresent([ProductImageReference].self, forKey: .product_images)

        if let originArray = try? container.decode([ProductOrigin].self, forKey: .origins) {
            origins = originArray
        } else if let originObject = try? container.decode(ProductOrigin.self, forKey: .origins) {
            origins = [originObject]
        } else {
            origins = nil
        }
    }

    var aliases: [String] {
        product_aliases?.map(\.alias) ?? []
    }

    var origin: ProductOrigin {
        origins?.first ?? ProductOrigin(origin_status: nil, confidence_level: nil, summary_reason: nil, country_code: nil, state_name: nil)
    }

    var referenceImages: [ProductImageReference] {
        let gallery = (product_images ?? []).sorted { left, right in
            if left.is_primary == right.is_primary {
                return left.image_url < right.image_url
            }

            return (left.is_primary ?? false) && !(right.is_primary ?? false)
        }

        if !gallery.isEmpty {
            return gallery
        }

        if let default_image_url {
            return [
                ProductImageReference(image_url: default_image_url, is_primary: true, source_type: "default")
            ]
        }

        return []
    }

    var originStatusLabel: String {
        switch origin.origin_status {
        case "hecho_en_mexico":
            "Hecho en Mexico"
        case "producido_en_mexico":
            "Producido en Mexico"
        case "empacado_en_mexico":
            "Empacado en Mexico"
        case "importado":
            "Importado"
        default:
            "Origen no confirmado"
        }
    }

    var confidenceLabel: String {
        switch origin.confidence_level {
        case "verificado":
            "Verificado"
        case "alta":
            "Alta confianza"
        case "media":
            "Confianza media"
        case "baja":
            "Baja confianza"
        default:
            "Sin confianza"
        }
    }

    var descriptionText: String {
        description ?? "No description available yet."
    }
}

struct OriginPoint: Identifiable {
    let id: String
    let title: String
    let shortLabel: String
    let coordinate: CLLocationCoordinate2D
    let count: Int
    let products: [String]
}

struct RecognizedDraftProduct: Decodable, Hashable {
    let name: String
    let brandName: String?
    let category: String
    let subcategory: String?
    let aliases: [String]
}

struct RecognizedItem: Decodable, Hashable, Identifiable {
    let suggestedProductId: UUID?
    let confidence: String
    let reasoning: String
    let visualGuess: String?
    let detectedText: [String]
    let originAssessment: String
    let originExplanation: String
    let evidenceNeeded: [String]
    let draftProduct: RecognizedDraftProduct?

    var id: String {
        [suggestedProductId?.uuidString, visualGuess, reasoning.prefix(32).description]
            .compactMap { $0 }
            .joined(separator: "::")
    }

    var originAssessmentLabel: String {
        switch originAssessment {
        case "confirmado_mexicano":
            "Confirmed Mexican"
        case "probable_mexicano":
            "Likely Mexican"
        default:
            "Unknown origin"
        }
    }
}

struct RecognitionPayload: Decodable {
    let detectedText: [String]
    let items: [RecognizedItem]
}

struct MadeinMService {
    private let summaryURL = URL(string: "https://jwqxshcyhzhnphlsgnnt.supabase.co/rest/v1/product_summary?select=id,name,category,origin_status,confidence_level,calories&order=name.asc")!
    private let catalogURL = URL(string: "https://jwqxshcyhzhnphlsgnnt.supabase.co/rest/v1/products?select=id,name,category,subcategory,brand_name,description,default_image_url,product_aliases(alias),product_images(image_url,is_primary,source_type),origins(origin_status,confidence_level,summary_reason,country_code,state_name)&status=eq.active&order=name.asc")!
    private let recognitionURL = URL(string: "https://www.estala.io/api/recognize")!
    private let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3cXhzaGN5aHpobnBobHNnbm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjcyMzQsImV4cCI6MjA5MDUwMzIzNH0.Gfn6daa78zHZHeRA502rf-zgEDpi1CNs_xH7cKVPssI"

    private let stateCoordinates: [String: (shortLabel: String, coordinate: CLLocationCoordinate2D)] = [
        "Estado de Mexico": ("Edo. Mex.", CLLocationCoordinate2D(latitude: 19.35, longitude: -99.66)),
        "Colima": ("Colima", CLLocationCoordinate2D(latitude: 19.24, longitude: -103.72)),
        "Michoacan": ("Michoacan", CLLocationCoordinate2D(latitude: 19.15, longitude: -101.88)),
        "Veracruz": ("Veracruz", CLLocationCoordinate2D(latitude: 19.54, longitude: -96.91)),
        "Chiapas": ("Chiapas", CLLocationCoordinate2D(latitude: 16.75, longitude: -93.12)),
    ]

    func fetchProducts() async throws -> [ProductSummary] {
        let request = authorizedRequest(for: summaryURL)
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, (200 ..< 300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode([ProductSummary].self, from: data)
    }

    func fetchCatalogProducts() async throws -> [CatalogProduct] {
        let request = authorizedRequest(for: catalogURL)
        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, (200 ..< 300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode([CatalogProduct].self, from: data)
    }

    func recognizeProducts(
        image: UIImage,
        candidates: [ProductSummary],
        barcodeValue: String?,
        marketContext: String,
        vendorOriginHint: String,
        observedTextHint: String
    ) async throws -> RecognitionPayload {
        guard let imageDataUrl = prepareRecognitionDataURL(from: image) else {
            throw URLError(.cannotEncodeContentData)
        }

        var request = URLRequest(url: recognitionURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = [
            "imageDataUrl": imageDataUrl,
            "barcodeValue": barcodeValue?.isEmpty == false ? barcodeValue : nil,
            "candidates": candidates.map { candidate in
                [
                    "id": candidate.id.uuidString,
                    "name": candidate.name,
                    "category": candidate.category,
                ]
            },
            "marketContext": marketContext.isEmpty ? nil : marketContext,
            "vendorOriginHint": vendorOriginHint.isEmpty ? nil : vendorOriginHint,
            "observedTextHint": observedTextHint.isEmpty ? nil : observedTextHint,
        ] as [String: Any?]

        request.httpBody = try JSONSerialization.data(withJSONObject: body.compactMapValues { $0 })

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }

        if !(200 ..< 300).contains(httpResponse.statusCode) {
            let message = String(data: data, encoding: .utf8) ?? "Recognition failed."
            throw NSError(domain: "MadeinMRecognition", code: httpResponse.statusCode, userInfo: [
                NSLocalizedDescriptionKey: message
            ])
        }

        return try JSONDecoder().decode(RecognitionPayload.self, from: data)
    }

    func suggestProducts(query: String, from products: [ProductSummary]) -> [ProductSummary] {
        let normalized = query
            .folding(options: .diacriticInsensitive, locale: .current)
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalized.isEmpty else {
            return Array(products.prefix(4))
        }

        return products.filter { product in
            let searchable = "\(product.name) \(product.category)"
                .folding(options: .diacriticInsensitive, locale: .current)
                .lowercased()
            return searchable.contains(normalized)
        }
    }

    func originPoints(from products: [CatalogProduct]) -> [OriginPoint] {
        let grouped = Dictionary(grouping: products) { $0.origin.state_name ?? "" }

        return grouped.compactMap { stateName, productsInState in
            guard !stateName.isEmpty, let state = stateCoordinates[stateName] else {
                return nil
            }

            return OriginPoint(
                id: stateName,
                title: stateName,
                shortLabel: state.shortLabel,
                coordinate: state.coordinate,
                count: productsInState.count,
                products: productsInState.map(\.name).sorted()
            )
        }
        .sorted { $0.title < $1.title }
    }

    private func authorizedRequest(for url: URL) -> URLRequest {
        var request = URLRequest(url: url)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")
        return request
    }

    private func prepareRecognitionDataURL(from image: UIImage) -> String? {
        let maxDimension: CGFloat = 1400
        let longestSide = max(image.size.width, image.size.height)
        let scale = min(1, maxDimension / max(longestSide, 1))
        let targetSize = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: targetSize)
        let resized = renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }

        guard let jpegData = resized.jpegData(compressionQuality: 0.76) else {
            return nil
        }

        return "data:image/jpeg;base64,\(jpegData.base64EncodedString())"
    }
}
