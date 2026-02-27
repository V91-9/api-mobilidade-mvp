/**
 * Converte graus para radianos (necessário para a fórmula matemática)
 */
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Calcula a distância em KM entre duas coordenadas geográficas (Fórmula de Haversine).
 * Serve para a Função 1, 2 e 3 que você pediu.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distância em km

  // Retorna a distância com apenas 2 casas decimais (ex: 4.52)
  return parseFloat(distance.toFixed(2));
}

/**
 * Calcula o valor da corrida com base na distância e no tipo de veículo (Função 4).
 */
function calculatePrice(distanceKm, rideType) {
  // Tabela de preços base do seu MVP (pode ser ajustada)
  const rates = {
    moto: { base: 3.0, perKm: 1.5 },
    carro_comum: { base: 5.0, perKm: 2.2 },
    carro_luxo: { base: 8.0, perKm: 3.5 },
  };

  // Se o tipo não existir, usa carro comum como padrão de segurança
  const rate = rates[rideType] || rates["carro_comum"];

  const total = rate.base + distanceKm * rate.perKm;

  // Retorna o valor em Reais (com 2 casas decimais)
  return parseFloat(total.toFixed(2));
}

/**
 * TEMPORARIO, MELHOR FAZER NO FRONTEND!!!!!!!!!!!!
 * 
 * Converte um endereço em texto para Coordenadas (Latitude e Longitude)
 * Usando a API gratuita do OpenStreetMap (Nominatim).
 */
async function geocodeAddress(address) {
    try {
        // Formata o endereço para a URL (ex: "Center Shopping" vira "Center%20Shopping")
        // Dica: Adicionamos "Brasil" para ajudar a API a não buscar ruas com o mesmo nome em Portugal, por exemplo.
        const query = encodeURIComponent(`${address}, Brasil`);
        const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

        const response = await fetch(url, {
            headers: {
                // A API exige que a gente se identifique
                "User-Agent": "AppMobilidadeMVP/1.0 (seu_email@teste.com)" 
            }
        });

        const data = await response.json();

        // Se a API não achar nada, retorna erro
        if (data.length === 0) {
            throw new Error(`Não foi possível encontrar as coordenadas para: ${address}`);
        }

        // Retorna a Latitude e Longitude do primeiro resultado
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
        };
    } catch (error) {
        console.error("Erro no Geocoding:", error.message);
        throw new Error("Erro ao buscar o endereço no mapa.");
    }
}

module.exports = {
  calculateDistance,
  calculatePrice,
  geocodeAddress, // TEMPORARIO, MELHOR FAZER NO FRONTEND!!!!!!!!!!!!
};
