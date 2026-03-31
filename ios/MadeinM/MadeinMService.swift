import Foundation

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

struct MadeinMService {
    private let apiURL = URL(string: "https://jwqxshcyhzhnphlsgnnt.supabase.co/rest/v1/product_summary?select=id,name,category,origin_status,confidence_level,calories&order=name.asc")!
    private let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3cXhzaGN5aHpobnBobHNnbm50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjcyMzQsImV4cCI6MjA5MDUwMzIzNH0.Gfn6daa78zHZHeRA502rf-zgEDpi1CNs_xH7cKVPssI"

    func fetchProducts() async throws -> [ProductSummary] {
        var request = URLRequest(url: apiURL)
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(anonKey)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse, (200 ..< 300).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }

        return try JSONDecoder().decode([ProductSummary].self, from: data)
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
}
