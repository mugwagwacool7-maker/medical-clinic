import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchServices, fetchDoctors, fetchAppointments } from './api';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import Booking from './components/Booking';
import MyAppointments from './components/MyAppointments';
import VisitInfo from './components/VisitInfo';
import Toast from './components/Toast';
import Footer from './components/Footer';

export default function App() {
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const [preselectedService, setPreselectedService] = useState(null);
  const [bookingKey, setBookingKey] = useState(0);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToastShow(false);
    }, 2600);
  }, []);

  const loadAppointments = useCallback(async () => {
    try {
      const appts = await fetchAppointments();
      setAppointments(appts);
    } catch {
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const [svcs, docs] = await Promise.all([fetchServices(), fetchDoctors()]);
        setServices(svcs);
        setDoctors(docs);
      } catch {
        const fallbackSvcs = [
          { id: 'cleaning', tag: 'PREVENTIVE', name: 'Routine Cleaning & Exam', desc: 'A full checkup and polish to keep things on track.', duration: '30 min', price: '$45' },
          { id: 'whitening', tag: 'COSMETIC', name: 'Teeth Whitening', desc: 'In-office whitening for a noticeably brighter smile.', duration: '60 min', price: '$120' },
          { id: 'filling', tag: 'RESTORATIVE', name: 'Cavity Filling', desc: 'Comfortable, tooth-colored fillings for minor decay.', duration: '45 min', price: '$80' },
          { id: 'extraction', tag: 'SURGICAL', name: 'Tooth Extraction', desc: 'Safe removal with local anesthesia and aftercare guidance.', duration: '45 min', price: '$95' },
          { id: 'rootcanal', tag: 'RESTORATIVE', name: 'Root Canal Therapy', desc: 'Relieve pain and save the tooth in a single focused visit.', duration: '90 min', price: '$260' },
          { id: 'consult', tag: 'GENERAL', name: 'New Patient Consultation', desc: 'A first visit to assess your dental health and plan next steps.', duration: '30 min', price: '$30' },
        ];
        const fallbackDocs = [
          { id: 'Finity', name: 'Dr. Finity', focus: 'General & preventive care' },
          { id: 'Mutenje', name: 'Dr. Mutenje', focus: 'Cosmetic dentistry' },
          { id: 'Gwenhamo', name: 'Dr. Gwenhamo', focus: 'Oral surgery' },
          { id: 'Moyo', name: 'Dr. Moyo', focus: 'Endodontics (root canals)' },
        ];
        setServices(fallbackSvcs);
        setDoctors(fallbackDocs);
      }
    }
    init();
    loadAppointments();
  }, [loadAppointments]);

  const handleBookService = (serviceId) => {
    setPreselectedService(serviceId);
    setBookingKey((k) => k + 1);
    setTimeout(() => {
      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  const handleAppointmentBooked = () => {
    loadAppointments();
    showToast('Appointment confirmed — see you then!');
  };

  const handleCancelAppointment = () => loadAppointments();

  return (
    <>
      <Header />
      <Hero />
      <Services services={services} onBookService={handleBookService} />
      <Booking
        key={bookingKey}
        services={services}
        doctors={doctors}
        preselectedService={preselectedService}
        onAppointmentBooked={handleAppointmentBooked}
        showToast={showToast}
      />
      <MyAppointments
        appointments={appointments}
        onCancel={handleCancelAppointment}
        showToast={showToast}
      />
      <VisitInfo />
      <Footer />
      <Toast message={toastMessage} show={toastShow} />
    </>
  );
}
