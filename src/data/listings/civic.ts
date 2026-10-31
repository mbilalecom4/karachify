import { makeListing } from '../factory';

const T = 'transport';
const G = 'government';
const E = 'emergency';
const PS = 'professional-services';

export const civic = [
  makeListing({
    slug: 'jinnah-international-airport',
    categoryId: T,
    areaId: 'dha',
    name: 'Jinnah International Airport',
    description:
      'Pakistan\'s busiest airport, four kilometres from the city centre, with the new terminal, the older terminal building, cargo village and the domestic piers that carry most of Sindh\'s traffic.',
    wiki: ['Jinnah International Airport', 'Karachi Airport'],
    address: 'Airport Road, near DHA Phase 7',
    facilities: ['Check-in halls', 'Lounges', 'Cargo village', 'Taxi rank', 'Parking', 'Domestic pier'],
    tags: ['Airport', 'Domestic', 'International', 'Transit'],
    featured: true,
    sourceUrl: 'https://en.wikipedia.org/wiki/Jinnah_International_Airport',
  }),
  makeListing({
    slug: 'seaview-ferry-terminal',
    categoryId: T,
    areaId: 'saddar',
    name: 'Sea View Ferry & Manora Boat Terminal',
    description:
      'The launch point for the ten-minute boat crossing to Manora island, run by the port department, with the ticket counter on the road side of the basin.',
    wiki: ['Manora Island', 'Port of Karachi'],
    address: 'Sea View, Marine Drive',
    facilities: ['Ticket counter', 'Life jackets', 'Daylight crossings', 'Weather dependent'],
    tags: ['Ferry', 'Island', 'Budget'],
  }),
  makeListing({
    slug: 'karachi-circular-railway',
    categoryId: T,
    areaId: 'saddar',
    name: 'Karachi Circular Railway (KCR)',
    description:
      'The commuter loop that links the port, Saddar, Landhi and Malir — partially reopened for local services, with the old station buildings still in use along the corridor.',
    wiki: ['Karachi Circular Railway'],
    address: 'KCR Road, Saddar to Landhi',
    facilities: ['Local trains', 'Commuter tickets', 'Station plazas'],
    tags: ['Commuter rail', 'Budget', 'Public'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Karachi_Circular_Railway',
  }),
  makeListing({
    slug: 'bahadurabad-bus-terminal',
    categoryId: T,
    areaId: 'bahadurabad',
    name: 'Bahadurabad Bus Terminal',
    description:
      'The intercity bus terminal that moves the city\'s southern traffic to Hyderabad, Sukkur and the interior, with booking offices along the flyover.',
    wiki: ['Bahadurabad', 'Bus station'],
    address: 'M.A. Johar Road, Bahadurabad',
    facilities: ['Booking counters', 'Bays', 'Waiting area', 'Parcel office', 'Toilets'],
    tags: ['Intercity', 'Bus', 'Travel'],
  }),
  makeListing({
    slug: 'karachi-port-cruise-terminal',
    categoryId: T,
    areaId: 'kemari',
    name: 'Karachi Port Cruise Terminal',
    description:
      'The terminal berth where cruise ships dock on Pakistan itineraries, with the customs hall, coach parking and the guided port tour arrangements.',
    wiki: ['Port of Karachi', 'Karachi Port Trust'],
    address: 'King George Dock, Kemari',
    facilities: ['Cruise berth', 'Customs hall', 'Coach parking', 'Pre-arranged tours'],
    tags: ['Port', 'Cruise', 'Waterfront'],
  }),
  makeListing({
    slug: 'karachi-metropolitan-corporation',
    categoryId: G,
    areaId: 'saddar',
    name: 'Karachi Metropolitan Corporation (KMC)',
    description:
      'The municipal head office behind the Frere Hall lawns, where the trade licences, building complaints, solid-waste and park-related counters are handled.',
    wiki: ['Karachi Metropolitan Corporation', 'Karachi Municipal Building'],
    address: 'Ridge Road, Saddar',
    facilities: ['Public counters', 'Records section', 'Help desk', 'Parking'],
    tags: ['Government', 'Municipal', 'Services'],
    sourceUrl: 'https://en.wikipedia.org/wiki/Karachi_Metropolitan_Corporation',
  }),
  makeListing({
    slug: 'rescue-1122-karachi',
    categoryId: E,
    areaId: 'saddar',
    name: 'Rescue 1122',
    description:
      'The provincial emergency rescue service — ambulance, fire, urban search and rescue, and boat rescue for the monsoon-flooded streets, dispatched on 1122.',
    wiki: ['Rescue 1122'],
    address: 'Stations across all seven districts',
    facilities: ['Ambulance', 'Fire response', 'Urban search & rescue', 'Boat rescue'],
    tags: ['Emergency', 'Ambulance', 'Free'],
    featured: true,
    phone: '1122',
    sourceUrl: 'https://commissionerkarachi.gos.pk/emergency-services',
    lastVerified: '2026-10-31',
  }),
  makeListing({
    slug: 'edhi-foundation-karachi',
    categoryId: E,
    areaId: 'lyari',
    name: 'Edhi Foundation Ambulance Service',
    description:
      'The charitable ambulance network founded by Abdul Sattar Edhi, running the world\'s largest volunteer ambulance fleet, plus shelter, maternity and cremation services.',
    wiki: ['Edhi Foundation', 'Abdul Sattar Edhi'],
    address: 'Head office, Sarafa Bazar, Boulton Market, Mithadar, Karachi',
    facilities: ['Free ambulance', 'Shelters', 'Maternity homes', 'Thana (police-aid)'],
    tags: ['Charity', 'Ambulance', 'Free', 'Emergency'],
    featured: true,
    phone: '115',
    sourceUrl: 'https://commissionerkarachi.gos.pk/emergency-services',
    lastVerified: '2026-10-31',
  }),
  makeListing({
    slug: 'sindh-police-hq',
    categoryId: E,
    areaId: 'dha',
    name: 'Sindh Police Headquarters & Complaint Cell',
    description:
      'The police headquarters block on Shahrah-e-Faisal, with the complaint office, the missing-person unit and the district station network around it.',
    wiki: ['Sindh Police', 'Karachi Police'],
    address: 'Shahrah-e-Faisal, I.I. Chundrigar side',
    facilities: ['Complaint office', 'Missing-person unit', 'Zainab Alert women’s helpline 1099'],
    tags: ['Police', 'Emergency', 'Public'],
    phone: '15',
    sourceUrl: 'https://karachipolice.gov.pk/services/emergency-contact-directory/',
    lastVerified: '2026-10-31',
  }),
  makeListing({
    slug: 'karachi-fire-brigade',
    categoryId: E,
    areaId: 'saddar',
    name: 'Karachi Fire Brigade',
    description:
      'The municipal fire service with the old-engine house near the cantonment and the station network that responds to the city\'s industrial and residential fires.',
    wiki: ['Karachi Fire Brigade', 'Fire station'],
    address: 'Station across Saddar, SITE, Malir',
    facilities: ['Fire response', 'Gas-leak callout', 'Water tankers'],
    tags: ['Fire', 'Emergency', 'Free'],
    phone: '16',
    sourceUrl: 'https://commissionerkarachi.gos.pk/emergency-services',
    lastVerified: '2026-10-31',
  }),
];
