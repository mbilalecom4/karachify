import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';

/* Every page is its own chunk so the first paint only carries the shell and the homepage. */
const Home = lazy(() => import('./pages/Home'));
const Explore = lazy(() => import('./pages/Explore'));
const ServicesHub = lazy(() => import('./pages/ServicesHub'));
const OpenNow = lazy(() => import('./pages/OpenNow'));
const PlanDay = lazy(() => import('./pages/PlanDay'));
const OurServices = lazy(() => import('./pages/OurServices'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const AreasIndex = lazy(() => import('./pages/AreasIndex'));
const AreaPage = lazy(() => import('./pages/AreaPage'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const Events = lazy(() => import('./pages/Events'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const MapView = lazy(() => import('./pages/MapView'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const GuidesIndex = lazy(() => import('./pages/GuidesIndex'));
const GuideDetail = lazy(() => import('./pages/GuideDetail'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Profile = lazy(() => import('./pages/Profile'));
const Saved = lazy(() => import('./pages/Saved'));
const BusinessDashboard = lazy(() => import('./pages/BusinessDashboard'));
const ListYourBusiness = lazy(() => import('./pages/ListYourBusiness'));
const SubmitEvent = lazy(() => import('./pages/SubmitEvent'));
const Admin = lazy(() => import('./pages/Admin'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Advertise = lazy(() => import('./pages/Advertise'));
const Help = lazy(() => import('./pages/Help'));
const ImageCredits = lazy(() => import('./pages/ImageCredits'));
const Sources = lazy(() => import('./pages/Sources'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoading() {
  return (
    <div className="shell flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-navy-200 border-t-teal-500" aria-hidden />
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-navy-400">Loading Karachi…</p>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="services" element={<ServicesHub />} />
          <Route path="open-now" element={<OpenNow />} />
          <Route path="plan" element={<PlanDay />} />
          <Route path="our-services" element={<OurServices />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="areas" element={<AreasIndex />} />
          <Route path="area/:slug" element={<AreaPage />} />
          <Route path="place/:slug" element={<ListingDetail />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:slug" element={<EventDetail />} />
          <Route path="map" element={<MapView />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="guides" element={<GuidesIndex />} />
          <Route path="guides/:slug" element={<GuideDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
          <Route path="profile" element={<Profile />} />
          <Route path="saved" element={<Saved />} />
          <Route path="dashboard" element={<BusinessDashboard />} />
          <Route path="list-your-business" element={<ListYourBusiness />} />
          <Route path="submit-event" element={<SubmitEvent />} />
          <Route path="admin" element={<Admin />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="advertise" element={<Advertise />} />
          <Route path="help" element={<Help />} />
          <Route path="image-credits" element={<ImageCredits />} />
          <Route path="sources" element={<Sources />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
