import { makeListing } from '../factory';

const M = 'museums-galleries';
const C = 'art-culture';
const RE = 'religious-places';
const SP = 'sports-fitness';

export const culture = [
  makeListing({
    slug: 'state-bank-of-pakistan-museum',
    categoryId: M,
    areaId: 'saddar',
    name: 'State Bank of Pakistan Museum',
    description:
      'Currency museum in the old banking quarter tracing coin and note history from the Indus valley through to the rupee, with a working print-room display.',
    wiki: ['State Bank of Pakistan', 'Coins'],
    address: 'I.I. Chundrigar Road, Saddar',
    facilities: ['Coin galleries', 'Archive', 'Guided visits', 'Free entry'],
    tags: ['Museum', 'Free', 'History'],
  }),
  makeListing({
    slug: 'pakistan-railways-heritage',
    categoryId: M,
    areaId: 'saddar',
    name: 'Karachi Railway Station & Heritage Premises',
    description:
      'The 1898 station building with its clock tower and train-shed arches — the working terminus where the railway heritage and the daily commute meet.',
    wiki: ['Karachi Railway Station', 'Khyber Mail'],
    address: 'Plot Area, Saddar',
    facilities: ['Platform access', 'Waiting halls', 'Heritage architecture', 'Booking offices'],
    tags: ['Heritage', 'Transport', 'Architecture'],
  }),
  makeListing({
    slug: 'ansari-hall',
    categoryId: M,
    areaId: 'saddar',
    name: 'Ansari Hall Art Centre',
    description:
      'Long-running municipal art venue inside the KMC complex, hosting the city\'s painting exhibitions, art society shows and student displays.',
    wiki: ['Ansari Hall Art Centre', 'Karachi'],
    address: 'Ridge Road, near KMC, Saddar',
    facilities: ['Exhibition halls', 'Art society shows', 'Free entry'],
    tags: ['Art', 'Exhibitions', 'Free'],
  }),
  makeListing({
    slug: 'sughar-house',
    categoryId: C,
    areaId: 'dha',
    name: 'Sughar House Crafts Centre',
    description:
      'Design and craft outlet working with Sindhi and Baloch artisans — ajrak, block print, ralli quilts and embroidery, with a workshop room and a small exhibition.',
    wiki: ['Ajrak', 'Sindhi cap', 'Block printing'],
    address: 'DHA Phase 8, near the phase-8 market',
    facilities: ['Craft retail', 'Workshops', 'Exhibition corner', 'Card payment'],
    tags: ['Craft', 'Ajrak', 'Gifting', 'Culture'],
    featured: true,
  }),
  makeListing({
    slug: 'khi-literary-society',
    categoryId: C,
    areaId: 'gulshan-e-iqbal',
    name: 'Readers Book Centre, Frere Road',
    description:
      'Independent bookshop and reading room where the city\'s book-launch circuit, Urdu literature tables and school-text trade all pass through.',
    wiki: ['Bookshop', 'Urdu literature'],
    address: 'Frere Road, Gulshan-e-Iqbal',
    facilities: ['Urdu titles', 'Academic titles', 'Events', 'Reading corner'],
    tags: ['Books', 'Culture', 'Events'],
  }),
  makeListing({
    slug: 'masjid-e-tooba',
    categoryId: RE,
    areaId: 'dha',
    name: 'Masjid-e-Tooba (Gol Mahal Masjid)',
    description:
      'A single marble dome, one of the largest free-standing mosque domes in the world, on the DHA sea-facing ridge — built without a minaret and visible from the coast road.',
    wiki: ['Masjid-e-Tooba, Karachi', 'Tooba Mosque'],
    address: 'DHA Phase 5, near the sea face',
    facilities: ['Wudu area', 'Women\'s section', 'Photography outside prayer times', 'Free entry'],
    hours: [{ day: 'Every day', open: 'After Fajr to Isha' }],
    tags: ['Mosque', 'Architecture', 'Landmark', 'Free'],
    featured: true,
    sourceUrl: 'https://en.wikipedia.org/wiki/Tooba_Mosque',
  }),
  makeListing({
    slug: 'grand-mosque-karachi',
    categoryId: RE,
    areaId: 'gulistan-e-johar',
    name: 'Grand Mosque of Karachi',
    description:
      'The new-capacity grand mosque on the Johar side with a large courtyard, a blue-tiled shell and the Eid prayer arrangements that draw hundreds of thousands.',
    wiki: ['Grand Mosque of Karachi', 'Masjid-e-Azam Karachi'],
    address: 'Gulistan-e-Johar, Shahrah-e-Faisal',
    facilities: ['Courtyard', 'Women\'s gallery', 'Madressa', 'Parking', 'Eid arrangements'],
    hours: [{ day: 'Every day', open: 'After Fajr to Isha' }],
    tags: ['Mosque', 'Landmark', 'Free'],
    featured: true,
  }),
  makeListing({
    slug: 'gurdwara-karachi',
    categoryId: RE,
    areaId: 'saddar',
    name: 'Gurdwara Bungalow Granthi, Saddar',
    description:
      'The Sikh gurdwara serving the remaining Singh Sabha community of the old city, with langar on Sundays.',
    wiki: ['Gurdwara', 'Sikhism in Pakistan'],
    address: 'Bungalow Grade, Saddar',
    facilities: ['Langar', 'Worship hall', 'Community events'],
    tags: ['Gurdwara', 'Community', 'Free'],
    status: 'needs-review',
  }),
  makeListing({
    slug: 'st-andrews-scots-kirk',
    categoryId: RE,
    areaId: 'saddar',
    name: "St. Andrew's Scots Kirk",
    description:
      'Presbyterian church on Beacon House line, a red-brick 1852 building that has served the city\'s Protestant congregation for over 170 years.',
    wiki: ["St. Andrew's Kirk, Karachi"],
    address: 'McNair Road, Saddar',
    facilities: ['Sunday service', 'Heritage building', 'Weddings by booking'],
    tags: ['Church', 'Heritage', 'Architecture'],
  }),
  makeListing({
    slug: 'jamia-masjid-karachi',
    categoryId: RE,
    areaId: 'saddar',
    name: 'Jamiya Masjid, Kutcherie Bazaar',
    description:
      'Historic mosque of the old trading quarters, attached to the madressa network that still runs the Ramadan iftar and madressa classes.',
    wiki: ['Jamia Masjid Karachi', 'Kutchery Bazaar'],
    address: 'Kutchery Bazaar, Saddar',
    facilities: ['Madressa', 'Wudu area', 'Ramadan programme'],
    hours: [{ day: 'Every day', open: 'After Fajr to Isha' }],
    tags: ['Mosque', 'Old city', 'Free'],
  }),
  makeListing({
    slug: 'swaminarayan-temple-khi',
    categoryId: RE,
    areaId: 'saddar',
    name: 'Swaminaraya Mandir, Kharadar',
    description:
      'The Swaminarayan temple of the Kharadar Hindu community, still active for Diwali and the monthly puja days.',
    wiki: ['Swaminarayan Mandir Karachi', 'Kharadar'],
    address: 'Kharadar, Saddar',
    facilities: ['Worship', 'Festival days', 'Heritage building'],
    tags: ['Temple', 'Old city', 'Festivals'],
    status: 'needs-review',
  }),
  makeListing({
    slug: 'national-stadium-karachi',
    categoryId: SP,
    areaId: 'saddar',
    name: 'National Stadium Karachi',
    description:
      'The old Test venue at Dawa Road where Karachi\'s domestic cricket is played, with the pavilion, the grounds and the match-day crowds.',
    wiki: ['National Stadium, Karachi'],
    address: 'Usman Ali Khan Street, Saddar',
    facilities: ['Cricket ground', 'Pavilion', 'Practice nets', 'Match-day entry'],
    tags: ['Cricket', 'Stadium', 'Events'],
    featured: true,
    sourceUrl: 'https://en.wikipedia.org/wiki/National_Stadium,_Karachi',
  }),
  makeListing({
    slug: 'ibne-qasim-stadium',
    categoryId: SP,
    areaId: 'kemari',
    name: 'Ibn-e-Qasim Bagh Stadium',
    description:
      'The beach-side stadium of the old city, used for athletics meets, independence-day function and the occasional cricket game on a ground the sea surrounds.',
    wiki: ['Ibn-e-Qasim Bagh Stadium'],
    address: 'Cape Monze Road, Lyari',
    facilities: ['Athletics track', 'Football', 'Grandstand', 'Public events'],
    tags: ['Stadium', 'Athletics', 'Free'],
  }),
  makeListing({
    slug: 'karachi-gymkhana',
    categoryId: SP,
    areaId: 'dha',
    name: 'Karachi Gymkhana',
    description:
      'The colonial-era sports club on Shahrah-e-Faisal — squash courts, tennis, a golf course, swimming and the members\' restaurants that the city\'s sporting calendar runs around.',
    wiki: ['Gymkhana', 'Karachi Gymkhana'],
    address: 'Shahrah-e-Faisal, Clifton side',
    facilities: ['Squash', 'Tennis', 'Swimming pool', 'Golf', 'Membership', 'Dining'],
    tags: ['Club', 'Squash', 'Golf', 'Membership'],
  }),
];
