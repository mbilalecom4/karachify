import type { Guide } from '../types';

export const guides: Guide[] = [
  {
    id: 'one-day-karachi',
    slug: 'one-day-in-karachi',
    title: 'One Day in Karachi: the harbour-to-Clifton line',
    excerpt:
      'A single day that takes in the port, the old city, Sea View and the Clifton sunset — with the travel times that make it realistic rather than optimistic.',
    readMinutes: 6,
    area: 'Saddar → Clifton',
    tag: 'First visit',
    wiki: ['Karachi skyline', 'Port Grand', 'Mazar-e-Quaid'],
    sections: [
      {
        heading: 'Start at the water',
        body: [
          'Begin at Sea View and the breakwater while the light is low and the fishing boats are coming in. The Maritime Museum and the planetarium are on the same road if you have children with you.',
          'From there, Port Grand is a ten-minute drive for coffee in the heritage sheds before the heat builds.',
        ],
      },
      {
        heading: 'Midday in the old city',
        body: [
          'Empress Market and the surrounding lanes are the working heart of Karachi — fabric, spice, hardware and flowers in the same block. Go before 13:00, carry cash and keep bags forward.',
          'Frere Hall, four minutes away by car, is the calm stop: lawns, the library and usually an exhibition on the walls.',
        ],
      },
      {
        heading: 'Evening on the coast',
        body: [
          'Move west to Clifton for the beach strip. The park walk down to Sandspit is the standard sunset route, and the seafood places behind the basin work from around 19:00.',
          'Finish at Mazar-e-Quaid once the floodlights are on — the plaza is at its best after dark and the traffic around it eases off.',
        ],
      },
    ],
  },
  {
    id: 'karachi-food-guide',
    slug: 'where-karachi-eats',
    title: 'Where Karachi eats: biryani, nihari, chai and the night shift',
    excerpt:
      'How the city\'s food map actually works — by dish, by time of day and by the queues that tell you which counter is worth stopping at.',
    readMinutes: 8,
    area: 'City-wide',
    tag: 'Food',
    wiki: ['Biryani', 'Nihari', 'Karachi'],
    sections: [
      {
        heading: 'Breakfast is a category, not a meal',
        body: [
          'Nihari, haleem and paye run from early morning and finish by mid-afternoon — the pot closes when it empties. Halwa puri is the Saturday institution, and the fried-loaf counters in Federal B Area keep the longest hours.',
        ],
      },
      {
        heading: 'The biryani argument',
        body: [
          'Karachi biryani is beef-and-potato, cooked in layers, and the city will tell you the Burns Road counters beat the DHA ones. Order a full plate, ask for the alocu, and accept that the gravy comes separately.',
        ],
      },
      {
        heading: 'Chai culture',
        body: [
          'Doodh patti at a roadside counter, taftri — the whipped layered tea — on the Malir side, and the cafe rooms that have taken over the Clifton and DHA strip since 2015. Karak chai with bun kabab is the standard evening combination.',
        ],
      },
      {
        heading: 'Eating late',
        body: [
          'The city genuinely eats past midnight, especially in Ramadan. Kabab houses on the western side and the seafood places at Boat Basin stay open on the shift pattern, and delivery covers most districts until around 02:00.',
        ],
      },
    ],
  },
  {
    id: 'karachi-heritage-walk',
    slug: 'heritage-walk-saddar',
    title: 'The Saddar heritage walk: 1840s to the 1960s on foot',
    excerpt:
      'Eleven buildings within a fifteen-minute radius — Gothic, Indo-Saracenic, neoclassical and the early modern blocks — and what each one says about the city.',
    readMinutes: 7,
    area: 'Saddar',
    tag: 'Heritage',
    wiki: ['Frere Hall', 'Empress Market', 'Karachi architecture'],
    sections: [
      {
        heading: 'The civic core',
        body: [
          'Start at the clock tower of Empress Market, built in 1889, and work outward through the municipal block, the court buildings and the banking facades along I.I. Chundrigar Road.',
          'Frere Hall is the anchor: 1865, Gothic-revival, and still doing public work as a library and gallery.',
        ],
      },
      {
        heading: 'Houses and worship',
        body: [
          'The cantonment lanes hold the residential stock — Wazir Mansion, the Flagstaff House museum and the old club buildings. Add St. Andrew\'s, St. Patrick\'s and the Kharadar temples and you get the settlement pattern of the port city in one walk.',
        ],
      },
      {
        heading: 'Practical notes',
        body: [
          'Carry water, go before 11:00 or after 17:00, and park once — the distances are short but the pavement quality is uneven. Photography is fine externally; interiors need permission at the institutional buildings.',
        ],
      },
    ],
  },
  {
    id: 'karachi-with-kids',
    slug: 'karachi-with-kids',
    title: 'Karachi with kids: parks, water and a rain plan',
    excerpt:
      'The family day-out stock by age band, which ones need a ticket, and where to go when the monsoon closes the outdoor options.',
    readMinutes: 5,
    area: 'Clifton, DHA, Gulshan',
    tag: 'Family',
    wiki: ['Amusement park', 'Ocean Park Karachi'],
    sections: [
      {
        heading: 'Under eights',
        body: [
          'Dolphin Park and the beach-side play areas, Hill Park rides for a full morning, and the Lumbini park lake for the shortest version of the outing.',
        ],
      },
      {
        heading: 'Eight and up',
        body: [
          'Ocean Park for the water rides in summer, the Karachi Zoo for the botanical grounds as much as the animals, and the indoor play floors at the larger malls on the rainy days.',
        ],
      },
      {
        heading: 'The rain plan',
        body: [
          'Monsoon and the off-season squalls shut beaches and parks for days at a time. Keep a mall, an aquarium visit and one museum in the pocket as the alternative, and check the port-weather advisories before any boat crossing.',
        ],
      },
    ],
  },
  {
    id: 'karachi-shopping-guide',
    slug: 'shopping-in-karachi',
    title: 'Shopping in Karachi: mall, bazaar or the tailor',
    excerpt:
      'What the malls are for, what the bazaars still do better, and how the city\'s tailoring economy works when you need something made.',
    readMinutes: 6,
    area: 'City-wide',
    tag: 'Shopping',
    wiki: ['Dolmen Mall Clifton', 'Lucky One Mall', 'Bazaar'],
    sections: [
      {
        heading: 'Malls',
        body: [
          'Dolmen Clifton and Lucky One carry the brand stock and the cinema; the Johar and Tariq Road branches catch the eastern population. Mall hours slide late on weekends, and parking is the real time cost.',
        ],
      },
      {
        heading: 'Bazaars',
        body: [
          'Bohri Bazaar and Ahmadpur for fabric by the yard and bridal work, Ziafat Market for second-hand electronics, and the Saddar print and hardware streets for anything a workshop needs. Cash, bargaining and a morning slot.',
        ],
      },
      {
        heading: 'Getting it made',
        body: [
          'The measurement-and-stitch economy still runs the city\'s wardrobe: take fabric to a tailor, allow three to five days, and expect one fitting. Wedding-season turnaround stretches to two weeks.',
        ],
      },
    ],
  },
  {
    id: 'karachi-monsoon-guide',
    slug: 'karachi-in-the-monsoon',
    title: 'Karachi in the monsoon: what changes and what to avoid',
    excerpt:
      'The weeks when the coastline closes, the nullahs run and the city moves on a different clock — with the practical routes and the services to book ahead.',
    readMinutes: 5,
    area: 'City-wide',
    tag: 'Seasonal',
    wiki: ['Monsoon of South Asia', 'Malir River'],
    sections: [
      {
        heading: 'When it arrives',
        body: [
          'July through September brings the short, hard rain rather than days of drizzle. Afternoon downpours are the pattern; the morning usually stays clear.',
        ],
      },
      {
        heading: 'What to avoid',
        body: [
          'Underpasses and the nullah-adjacent roads during and immediately after heavy rain, the boat crossings when the port issues a warning, and the beach strips where the sand is not drained.',
        ],
      },
      {
        heading: 'What to plan around',
        body: [
          'Allow double travel time on Shahrah-e-Faisal and the Korangi road in an evening downpour. Book indoor venues, keep hospital visits for morning slots, and have the water and power backup checked before the season starts.',
        ],
      },
    ],
  },
  {
    id: 'karachi-for-business',
    slug: 'karachi-for-business-visitors',
    title: 'A business visitor\'s Karachi: airport, bank corridor and dinner',
    excerpt:
      'Where to stay for a two-day trip, how the airport-to-Shahrah-e-Faisal transfer actually behaves, and the four dinner formats that work.',
    readMinutes: 6,
    area: 'DHA, Clifton, Saddar',
    tag: 'Business',
    wiki: ['I.I. Chundrigar Road', 'Shahrah-e-Faisal'],
    sections: [
      {
        heading: 'Arrival and transfer',
        body: [
          'Jinnah International sits four to five kilometres from the Shahrah-e-Faisal corridor. Without traffic it is twelve minutes; in the evening peak it is forty-five. Take the airport-road side rather than the Marine Drive route.',
        ],
      },
      {
        heading: 'Where to base yourself',
        body: [
          'DHA and Clifton for the office stock and the restaurants; the Saddar banking block only if the meetings are there, since the two are twenty minutes apart and parking is difficult on both sides.',
        ],
      },
      {
        heading: 'Dinner formats',
        body: [
          'The private room at a family restaurant for a group, the grill house for a quick high-protein plate, the sea-facing dining at Clifton when a guest is visiting, and the banquet hall for anything above twelve people.',
        ],
      },
    ],
  },
  {
    id: 'karachi-photo-spots',
    slug: 'karachi-photo-spots',
    title: 'Twelve frames: the Karachi photography list',
    excerpt:
      'The views people fly in for — skyline, port cranes, colonial stone, the beach at dusk — with the time of day each one works.',
    readMinutes: 4,
    area: 'City-wide',
    tag: 'Photography',
    wiki: ['Karachi skyline', 'Sea View, Karachi', 'Mohatta Palace'],
    sections: [
      {
        heading: 'Golden hour',
        body: [
          'Sea View breakwater and Paradise Point for the skyline with water in front; the port cranes read best from the Kemari side with the sun behind them.',
        ],
      },
      {
        heading: 'Blue hour and after',
        body: [
          'Mazar-e-Quaid floodlit, Port Grand\'s bridge and sheds, and the Frere Hall clock tower with the lawns lit. Long exposures work; tripods are fine at the plaza but check with security at the institutional buildings.',
        ],
      },
      {
        heading: 'Street frames',
        body: [
          'Empress Market at opening, the Burns Road food counters at night, the boatyard at Boat Basin and the kite lines over the beach in Basant season. Ask before photographing people, and keep gear discreet in the dense markets.',
        ],
      },
    ],
  },
];

export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug || g.id === slug);
}
