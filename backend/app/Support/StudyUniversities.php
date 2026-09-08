<?php

namespace App\Support;

final class StudyUniversities
{
    /**
     * Popular universities students can pick after choosing a country.
     * Staff catalog entries for the same country are merged in by the API.
     *
     * @return array<string, list<array{name: string, city: ?string}>>
     */
    public static function byCountry(): array
    {
        return [
            'Australia' => [
                ['name' => 'University of Melbourne', 'city' => 'Melbourne'],
                ['name' => 'University of Sydney', 'city' => 'Sydney'],
                ['name' => 'Monash University', 'city' => 'Melbourne'],
                ['name' => 'University of New South Wales', 'city' => 'Sydney'],
                ['name' => 'Australian National University', 'city' => 'Canberra'],
                ['name' => 'University of Queensland', 'city' => 'Brisbane'],
            ],
            'Canada' => [
                ['name' => 'University of Toronto', 'city' => 'Toronto'],
                ['name' => 'University of British Columbia', 'city' => 'Vancouver'],
                ['name' => 'McGill University', 'city' => 'Montreal'],
                ['name' => 'University of Waterloo', 'city' => 'Waterloo'],
                ['name' => 'University of Alberta', 'city' => 'Edmonton'],
                ['name' => 'McMaster University', 'city' => 'Hamilton'],
                ['name' => 'Western University', 'city' => 'London'],
                ['name' => 'Queen\'s University', 'city' => 'Kingston'],
            ],
            'UK' => [
                ['name' => 'University of Oxford', 'city' => 'Oxford'],
                ['name' => 'University of Cambridge', 'city' => 'Cambridge'],
                ['name' => 'Imperial College London', 'city' => 'London'],
                ['name' => 'University College London', 'city' => 'London'],
                ['name' => 'University of Edinburgh', 'city' => 'Edinburgh'],
                ['name' => 'University of Manchester', 'city' => 'Manchester'],
                ['name' => 'King\'s College London', 'city' => 'London'],
                ['name' => 'University of Warwick', 'city' => 'Coventry'],
            ],
            'USA' => [
                ['name' => 'Harvard University', 'city' => 'Cambridge'],
                ['name' => 'Stanford University', 'city' => 'Stanford'],
                ['name' => 'Massachusetts Institute of Technology', 'city' => 'Cambridge'],
                ['name' => 'University of California, Berkeley', 'city' => 'Berkeley'],
                ['name' => 'Columbia University', 'city' => 'New York'],
                ['name' => 'University of Michigan', 'city' => 'Ann Arbor'],
                ['name' => 'New York University', 'city' => 'New York'],
                ['name' => 'University of California, Los Angeles', 'city' => 'Los Angeles'],
            ],
            'Germany' => [
                ['name' => 'Technical University of Munich', 'city' => 'Munich'],
                ['name' => 'Ludwig Maximilian University of Munich', 'city' => 'Munich'],
                ['name' => 'Heidelberg University', 'city' => 'Heidelberg'],
                ['name' => 'Humboldt University of Berlin', 'city' => 'Berlin'],
                ['name' => 'RWTH Aachen University', 'city' => 'Aachen'],
                ['name' => 'University of Freiburg', 'city' => 'Freiburg'],
            ],
            'Ireland' => [
                ['name' => 'Trinity College Dublin', 'city' => 'Dublin'],
                ['name' => 'University College Dublin', 'city' => 'Dublin'],
                ['name' => 'University College Cork', 'city' => 'Cork'],
                ['name' => 'University of Galway', 'city' => 'Galway'],
                ['name' => 'Dublin City University', 'city' => 'Dublin'],
            ],
            'Netherlands' => [
                ['name' => 'University of Amsterdam', 'city' => 'Amsterdam'],
                ['name' => 'Delft University of Technology', 'city' => 'Delft'],
                ['name' => 'Utrecht University', 'city' => 'Utrecht'],
                ['name' => 'Erasmus University Rotterdam', 'city' => 'Rotterdam'],
                ['name' => 'Leiden University', 'city' => 'Leiden'],
            ],
            'Malaysia' => [
                ['name' => 'University of Malaya', 'city' => 'Kuala Lumpur'],
                ['name' => 'Universiti Putra Malaysia', 'city' => 'Serdang'],
                ['name' => 'Universiti Kebangsaan Malaysia', 'city' => 'Bangi'],
                ['name' => 'Universiti Teknologi Malaysia', 'city' => 'Johor Bahru'],
                ['name' => 'Taylor\'s University', 'city' => 'Subang Jaya'],
            ],
            'UAE' => [
                ['name' => 'United Arab Emirates University', 'city' => 'Al Ain'],
                ['name' => 'American University of Sharjah', 'city' => 'Sharjah'],
                ['name' => 'Khalifa University', 'city' => 'Abu Dhabi'],
                ['name' => 'University of Dubai', 'city' => 'Dubai'],
            ],
            'Turkey' => [
                ['name' => 'Middle East Technical University', 'city' => 'Ankara'],
                ['name' => 'Boğaziçi University', 'city' => 'Istanbul'],
                ['name' => 'Istanbul Technical University', 'city' => 'Istanbul'],
                ['name' => 'Koç University', 'city' => 'Istanbul'],
                ['name' => 'Bilkent University', 'city' => 'Ankara'],
            ],
            'Cyprus' => [
                ['name' => 'University of Cyprus', 'city' => 'Nicosia'],
                ['name' => 'Eastern Mediterranean University', 'city' => 'Famagusta'],
                ['name' => 'Near East University', 'city' => 'Nicosia'],
                ['name' => 'Cyprus International University', 'city' => 'Nicosia'],
            ],
            'Italy' => [
                ['name' => 'University of Bologna', 'city' => 'Bologna'],
                ['name' => 'Sapienza University of Rome', 'city' => 'Rome'],
                ['name' => 'Politecnico di Milano', 'city' => 'Milan'],
                ['name' => 'University of Padua', 'city' => 'Padua'],
            ],
            'France' => [
                ['name' => 'Sorbonne University', 'city' => 'Paris'],
                ['name' => 'Université PSL', 'city' => 'Paris'],
                ['name' => 'École Polytechnique', 'city' => 'Palaiseau'],
                ['name' => 'Sciences Po', 'city' => 'Paris'],
            ],
            'New Zealand' => [
                ['name' => 'University of Auckland', 'city' => 'Auckland'],
                ['name' => 'University of Otago', 'city' => 'Dunedin'],
                ['name' => 'Victoria University of Wellington', 'city' => 'Wellington'],
                ['name' => 'University of Canterbury', 'city' => 'Christchurch'],
            ],
            'Poland' => [
                ['name' => 'University of Warsaw', 'city' => 'Warsaw'],
                ['name' => 'Jagiellonian University', 'city' => 'Kraków'],
                ['name' => 'Warsaw University of Technology', 'city' => 'Warsaw'],
            ],
            'Hungary' => [
                ['name' => 'Eötvös Loránd University', 'city' => 'Budapest'],
                ['name' => 'University of Debrecen', 'city' => 'Debrecen'],
                ['name' => 'Semmelweis University', 'city' => 'Budapest'],
            ],
            'Sweden' => [
                ['name' => 'Lund University', 'city' => 'Lund'],
                ['name' => 'Uppsala University', 'city' => 'Uppsala'],
                ['name' => 'KTH Royal Institute of Technology', 'city' => 'Stockholm'],
            ],
            'Denmark' => [
                ['name' => 'University of Copenhagen', 'city' => 'Copenhagen'],
                ['name' => 'Technical University of Denmark', 'city' => 'Lyngby'],
                ['name' => 'Aarhus University', 'city' => 'Aarhus'],
            ],
            'Norway' => [
                ['name' => 'University of Oslo', 'city' => 'Oslo'],
                ['name' => 'Norwegian University of Science and Technology', 'city' => 'Trondheim'],
                ['name' => 'University of Bergen', 'city' => 'Bergen'],
            ],
            'Finland' => [
                ['name' => 'University of Helsinki', 'city' => 'Helsinki'],
                ['name' => 'Aalto University', 'city' => 'Espoo'],
                ['name' => 'University of Turku', 'city' => 'Turku'],
            ],
            'Spain' => [
                ['name' => 'University of Barcelona', 'city' => 'Barcelona'],
                ['name' => 'Complutense University of Madrid', 'city' => 'Madrid'],
                ['name' => 'Autonomous University of Barcelona', 'city' => 'Barcelona'],
            ],
            'Portugal' => [
                ['name' => 'University of Lisbon', 'city' => 'Lisbon'],
                ['name' => 'University of Porto', 'city' => 'Porto'],
                ['name' => 'University of Coimbra', 'city' => 'Coimbra'],
            ],
            'Austria' => [
                ['name' => 'University of Vienna', 'city' => 'Vienna'],
                ['name' => 'TU Wien', 'city' => 'Vienna'],
                ['name' => 'University of Innsbruck', 'city' => 'Innsbruck'],
            ],
            'Belgium' => [
                ['name' => 'KU Leuven', 'city' => 'Leuven'],
                ['name' => 'Ghent University', 'city' => 'Ghent'],
                ['name' => 'Université libre de Bruxelles', 'city' => 'Brussels'],
            ],
            'Switzerland' => [
                ['name' => 'ETH Zurich', 'city' => 'Zurich'],
                ['name' => 'EPFL', 'city' => 'Lausanne'],
                ['name' => 'University of Zurich', 'city' => 'Zurich'],
            ],
            'Japan' => [
                ['name' => 'University of Tokyo', 'city' => 'Tokyo'],
                ['name' => 'Kyoto University', 'city' => 'Kyoto'],
                ['name' => 'Osaka University', 'city' => 'Osaka'],
            ],
            'China' => [
                ['name' => 'Tsinghua University', 'city' => 'Beijing'],
                ['name' => 'Peking University', 'city' => 'Beijing'],
                ['name' => 'Fudan University', 'city' => 'Shanghai'],
            ],
            'South Korea' => [
                ['name' => 'Seoul National University', 'city' => 'Seoul'],
                ['name' => 'KAIST', 'city' => 'Daejeon'],
                ['name' => 'Yonsei University', 'city' => 'Seoul'],
            ],
            'Malta' => [
                ['name' => 'University of Malta', 'city' => 'Msida'],
            ],
        ];
    }

    /**
     * @return list<array{name: string, city: ?string}>
     */
    public static function forCountry(string $country): array
    {
        return self::byCountry()[$country] ?? [];
    }
}
