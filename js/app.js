document.addEventListener('DOMContentLoaded', () => {
    const opponentList = document.getElementById('opponent-list');
    const modal = document.getElementById('opponent-modal');
    const modalTitle = document.getElementById('modal-title');
    const form = document.getElementById('opponent-form');
    const addOpponentBtn = document.getElementById('add-opponent-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const exportBtn = document.getElementById('export-data-btn');
    const importFile = document.getElementById('import-file');

    const myStrengthsEl = document.getElementById('my-strengths');
    const myWeaknessesEl = document.getElementById('my-weaknesses');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const MY_PROFILE_KEY = 'tennisMyProfile';

    // --- Data Management ---
    const getOpponents = () => JSON.parse(localStorage.getItem('tennisLedgerOpponents')) || [];
    const saveOpponents = (opponents) => localStorage.setItem('tennisLedgerOpponents', JSON.stringify(opponents));

    // --- Profile Functions ---
    const saveMyProfile = () => {
        const profile = {
            strengths: myStrengthsEl.value,
            weaknesses: myWeaknessesEl.value,
        };
        localStorage.setItem(MY_PROFILE_KEY, JSON.stringify(profile));
        
        saveProfileBtn.textContent = 'Profile Saved!';
        setTimeout(() => { saveProfileBtn.textContent = 'Save My Profile'; }, 2000);
    };

    const loadMyProfile = () => {
        const profile = JSON.parse(localStorage.getItem(MY_PROFILE_KEY)) || { strengths: '', weaknesses: '' };
        myStrengthsEl.value = profile.strengths;
        myWeaknessesEl.value = profile.weaknesses;
    };

    // --- UI Rendering ---
    const renderOpponents = () => {
        const opponents = getOpponents();
        opponentList.innerHTML = '';
        if (opponents.length === 0) {
            opponentList.innerHTML = '<p>No opponents added yet. Click "Add Opponent" to start!</p>';
            return;
        }
        opponents.sort((a, b) => a.name.localeCompare(b.name));
        opponents.forEach(opponent => {
            const card = document.createElement('div');
            card.className = 'opponent-card';
            card.innerHTML = `
                <h3>${opponent.name}</h3>
                <div class="opponent-card-actions">
                    <a href="opponent.html?id=${opponent.id}" class="primary-btn">View Details</a>
                    <button class="edit-btn" data-id="${opponent.id}">Edit</button>
                    <button class="delete-btn" data-id="${opponent.id}">Delete</button>
                </div>
            `;
            opponentList.appendChild(card);
        });
    };

    // --- Modal & Form Handling ---
    const showModal = (title = 'Add New Opponent', opponent = null) => {
        modalTitle.textContent = title;
        form.reset();
        document.getElementById('opponent-id').value = '';
        if (opponent) {
            document.getElementById('opponent-id').value = opponent.id;
            document.getElementById('name').value = opponent.name;
            document.getElementById('style').value = opponent.style || '';
            document.getElementById('strengths').value = opponent.strengths.join(', ');
            document.getElementById('weaknesses').value = opponent.weaknesses.join(', ');

            document.getElementById('mental-notes').value = opponent.mentalNotes || '';
        }
        modal.style.display = 'flex';
    };

    const hideModal = () => modal.style.display = 'none';

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('opponent-id').value;
        const name = document.getElementById('name').value.trim();
        const style = document.getElementById('style').value;
        const strengths = document.getElementById('strengths').value.split(',').map(s => s.trim()).filter(Boolean);
        const weaknesses = document.getElementById('weaknesses').value.split(',').map(s => s.trim()).filter(Boolean);

        const mentalNotes = document.getElementById('mental-notes').value.trim();

        if (!name) return alert('Opponent name is required.');

        let opponents = getOpponents();
        if (id) {
            opponents = opponents.map(opp => {
                if (opp.id == id) {
                    const existingOpponent = getOpponents().find(o => o.id == id);
                    const hasChanged = JSON.stringify(existingOpponent.strengths.sort()) !== JSON.stringify(strengths.sort()) ||
                                     JSON.stringify(existingOpponent.weaknesses.sort()) !== JSON.stringify(weaknesses.sort()) ||
                                     existingOpponent.style !== style ||
                                     existingOpponent.mentalNotes !== mentalNotes;

                    const updatedOpponent = { ...opp, name, style, strengths, weaknesses, mentalNotes };
                    if (hasChanged) updatedOpponent.tactics = ''; // Clear tactics
                    return updatedOpponent;
                }
                return opp;
            });
        } else { 
            opponents.push({ id: Date.now(), name, style, strengths, weaknesses, mentalNotes, matches: [], tactics: '' });
        }
        saveOpponents(opponents);
        renderOpponents();
        hideModal();
    });

    // --- Event Listeners ---
    addOpponentBtn.addEventListener('click', () => showModal());
    cancelBtn.addEventListener('click', hideModal);
    saveProfileBtn.addEventListener('click', saveMyProfile);

    opponentList.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        if (!id) return;
        if (e.target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this opponent?')) {
                saveOpponents(getOpponents().filter(opp => opp.id != id));
                renderOpponents();
            }
        }
        if (e.target.classList.contains('edit-btn')) {
            const opponentToEdit = getOpponents().find(opp => opp.id == id);
            showModal('Edit Opponent', opponentToEdit);
        }
    });
    
    exportBtn.addEventListener('click', () => {
        const opponents = getOpponents();
        if (opponents.length === 0) {
            alert('No data to export.');
            return;
        }
        const dataStr = JSON.stringify({ opponents: opponents, profile: JSON.parse(localStorage.getItem(MY_PROFILE_KEY)) }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tennis_ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data.opponents) && typeof data.profile === 'object') {
                    if (confirm('This will overwrite your current data. Are you sure?')) {
                        saveOpponents(data.opponents);
                        localStorage.setItem(MY_PROFILE_KEY, JSON.stringify(data.profile));
                        renderOpponents();
                        loadMyProfile();
                        alert('Data imported successfully!');
                    }
                } else { throw new Error('Invalid file format.'); }
            } catch (error) {
                alert('Error importing file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // Initial Load
    loadMyProfile();
    renderOpponents();
});