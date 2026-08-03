import { useState, useEffect } from 'preact/hooks';
import { useGoogleAuth } from './hooks/useGoogleAuth.js';
import { useSheetsData } from './hooks/useSheetsData.js';
import { Header } from './components/Header.jsx';
import { Dashboard } from './components/Dashboard.jsx';
import { PlantDetail } from './components/PlantDetail.jsx';
import { AddPlantForm } from './components/AddPlantForm.jsx';

export function App() {
  const auth = useGoogleAuth();
  const data = useSheetsData(auth.accessToken);
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'detail' | 'addPlant'
  const [propagateFrom, setPropagateFrom] = useState(null);

  // Persistent filter state (survives navigation to detail/addPlant and back)
  const [filterType, setFilterType] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('urgency');
  const [showImages, setShowImages] = useState(true);

  // Scroll to top when navigating to detail or addPlant
  useEffect(() => {
    if (view === 'detail' || view === 'addPlant') {
      window.scrollTo(0, 0);
    }
  }, [view]);

  // Push browser history so Android back button navigates within the app
  useEffect(() => {
    if (view !== 'dashboard') {
      history.pushState({ view }, '');
    }
  }, [view]);

  useEffect(() => {
    const onPopState = () => {
      setSelectedPlant(null);
      setPropagateFrom(null);
      setView('dashboard');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (!auth.isSignedIn) {
    return (
      <div class="login-screen">
        <h1>🌱 Plant Tracker</h1>
        <p>Sign in to manage your plants</p>
        <button class="btn btn-primary" onClick={auth.signIn}>
          Sign in with Google
        </button>
      </div>
    );
  }

  const handleSelectPlant = (plant) => {
    setSelectedPlant(plant);
    setView('detail');
  };

  const handleBack = () => {
    setSelectedPlant(null);
    setPropagateFrom(null);
    setView('dashboard');
  };

  const handleAddPlantSubmit = async (plantData) => {
    await data.addPlant(plantData);
  };

  const handleRemovePlant = async (plantId) => {
    await data.removePlant(plantId);
    setSelectedPlant(null);
    setView('dashboard');
  };

  const handleAddScheduleFromForm = async (plantId, cadence, eventType) => {
    await data.addSchedule(plantId, cadence, eventType);
  };

  const handlePropagate = (plant) => {
    setPropagateFrom({
      name: `${plant.name} Baby`,
      species: plant.species || '',
      caretaker: plant.caretaker || '',
      location: plant.location || '',
      acquiredDate: new Date().toISOString().split('T')[0],
      pot: plant.pot || '',
      notes: plant.notes || '',
    });
    setView('addPlant');
  };

  if (view === 'addPlant') {
    return (
      <>
        <Header user={auth.user} onSignOut={auth.signOut} syncStatus={data.syncStatus} showImages={showImages} onToggleImages={() => setShowImages(!showImages)} />
        <AddPlantForm
          data={data}
          onSubmit={handleAddPlantSubmit}
          onAddSchedule={handleAddScheduleFromForm}
          onCancel={handleBack}
          defaultValues={propagateFrom}
        />
      </>
    );
  }

  if (view === 'detail' && selectedPlant) {
    return (
      <>
        <Header user={auth.user} onSignOut={auth.signOut} syncStatus={data.syncStatus} showImages={showImages} onToggleImages={() => setShowImages(!showImages)} />
        <PlantDetail
          plant={selectedPlant}
          data={data}
          onBack={handleBack}
          onAction={(outcome) => data.logEvent(selectedPlant.id, selectedPlant._dueEventType, outcome)}
          onRemove={handleRemovePlant}
          onPropagate={handlePropagate}
          showImages={showImages}
        />
      </>
    );
  }

  return (
    <>
      <Header user={auth.user} onSignOut={auth.signOut} syncStatus={data.syncStatus} showImages={showImages} onToggleImages={() => setShowImages(!showImages)} />
      <Dashboard
        data={data}
        caretaker={auth.caretaker}
        onSelectPlant={handleSelectPlant}
        onAction={data.logEvent}
        onAddPlant={() => { setPropagateFrom(null); setView('addPlant'); }}
        filterType={filterType}
        filterLocation={filterLocation}
        search={search}
        onFilterTypeChange={setFilterType}
        onFilterLocationChange={setFilterLocation}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortChange={setSortBy}
        showImages={showImages}
      />
    </>
  );
}
