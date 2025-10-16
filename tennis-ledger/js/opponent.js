document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const opponentNameEl = document.getElementById('opponent-name');
    const opponentStyleEl = document.getElementById('opponent-style');
    const strengthsListEl = document.getElementById('strengths-list');
    const weaknessesListEl = document.getElementById('weaknesses-list');
    const mentalNotesSection = document.getElementById('mental-notes-section');
    const mentalNotesDisplay = document.getElementById('mental-notes-display');
    const matchHistoryBody = document.querySelector('#match-history tbody');
    const addMatchForm = document.getElementById('add-match-form');
    const generateTacticsBtn = document.getElementById('generate-tactics-btn');
    const tacticsOutput = document.getElementById('tactics-output');

    // --- Data Management ---
    const getOpponents = () => JSON.parse(localStorage.getItem('tennisLedgerOpponents')) || [];
    const saveOpponents = (opponents) => localStorage.setItem('tennisLedgerOpponents', JSON.stringify(opponents));
    const API_KEY_STORAGE_KEY = 'geminiApiKey';

    const getApiKey = () => {
        let key = localStorage.getItem(API_KEY_STORAGE_KEY);
        if (!key) {
            key = prompt('Please enter your Google AI (Gemini) API Key. It will be stored locally in your browser.');
            if (key) {
                localStorage.setItem(API_KEY_STORAGE_KEY, key);
            }
        }
        return key;
    };
    
    // --- Get Opponent from URL ---
    const params = new URLSearchParams(window.location.search);
    const opponentId = params.get('id');
    let opponents = getOpponents();
    let currentOpponent = opponents.find(opp => opp.id == opponentId);

    if (!currentOpponent) {
        opponentNameEl.textContent = 'Opponent Not Found';
        document.querySelectorAll('.detail-section').forEach(el => el.style.display = 'none');
        return;
    }
    
    // --- UI Rendering ---
    const renderDetails = () => {
        opponentNameEl.textContent = currentOpponent.name;
        document.title = `${currentOpponent.name} | Tennis Ledger`;

        if (currentOpponent.style && currentOpponent.style !== "Unknown") {
            opponentStyleEl.textContent = currentOpponent.style;
            opponentStyleEl.style.display = 'inline-block';
        } else {
            opponentStyleEl.style.display = 'none';
        }

        strengthsListEl.innerHTML = currentOpponent.strengths.map(s => `<li>${s}</li>`).join('') || '<li>No strengths listed.</li>';
        weaknessesListEl.innerHTML = currentOpponent.weaknesses.map(w => `<li>${w}</li>`).join('') || '<li>No weaknesses listed.</li>';

        if (currentOpponent.mentalNotes) {
            mentalNotesDisplay.textContent = currentOpponent.mentalNotes;
            mentalNotesSection.style.display = 'block';
        } else {
            mentalNotesSection.style.display = 'none';
        }
        
        if (currentOpponent.tactics) {
            tacticsOutput.innerHTML = currentOpponent.tactics;
            generateTacticsBtn.textContent = 'Regenerate Game Plan';
        } else {
            tacticsOutput.innerHTML = '<p><em>No game plan has been generated yet.</em></p>';
            generateTacticsBtn.textContent = 'Generate Game Plan';
        }
        renderMatchHistory();
    };

    const renderMatchHistory = () => {
        matchHistoryBody.innerHTML = '';
        if (currentOpponent.matches.length === 0) {
            matchHistoryBody.innerHTML = '<tr><td colspan="3">No matches recorded yet.</td></tr>';
            return;
        }
        currentOpponent.matches.sort((a, b) => new Date(b.date) - new Date(a.date));
        currentOpponent.matches.forEach((match, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(match.date).toLocaleDateString('nb-NO')}</td>
                <td>${match.score}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            matchHistoryBody.appendChild(row);
        });
    };

    // --- Event Listeners ---
    addMatchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('match-date').value;
        const score = document.getElementById('match-score').value.trim();
        if (!date || !score) {
            alert('Please provide both a date and a score.');
            return;
        }
        currentOpponent.matches.push({ date, score });
        const updatedOpponents = opponents.map(opp => opp.id == opponentId ? currentOpponent : opp);
        saveOpponents(updatedOpponents);
        renderMatchHistory();
        addMatchForm.reset();
    });

    matchHistoryBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const matchIndex = e.target.dataset.index;
            if (confirm('Are you sure you want to delete this match record?')) {
                currentOpponent.matches.splice(matchIndex, 1);
                const updatedOpponents = opponents.map(opp => opp.id == opponentId ? currentOpponent : opp);
                saveOpponents(updatedOpponents);
                renderMatchHistory();
            }
        }
    });

    // --- Helper Function & Gemini Integration ---

    const markdownToHtml = (text) => {
        // Pre-process to fix AI mistakes like multiple bullets on one line
        const cleanedText = text.replace(/(\.) ([\*\-]) /g, '$1\n$2 ');

        const lines = cleanedText.split('\n');
        let html = '';
        let inList = false;

        for (const line of lines) {
            // Handle Headings
            if (line.startsWith('### ')) {
                if (inList) {
                    html += '</ul>';
                    inList = false;
                }
                html += `<h3>${line.substring(4)}</h3>`;
                continue;
            }

            // Handle Bullet Points
            if (line.startsWith('* ') || line.startsWith('- ')) {
                if (!inList) {
                    html += '<ul>';
                    inList = true;
                }
                // Process content inside the list item for bolding
                const content = line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                html += `<li>${content}</li>`;
                continue;
            }

            // Handle regular paragraphs and close any open lists
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (line.trim() !== '') {
                // Process paragraphs for bolding as well
                const content = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                html += `<p>${content}</p>`;
            }
        }

        // Close any list that might be open at the very end
        if (inList) {
            html += '</ul>';
        }

        return html;
    };

    const generateTactics = async () => {
        const apiKey = getApiKey();
        if (!apiKey) {
            tacticsOutput.innerHTML = '<p style="color: red;">API Key is required to generate tactics.</p>';
            return;
        }

        tacticsOutput.innerHTML = '<div class="loader"></div>';
        generateTacticsBtn.disabled = true;

        const myProfile = JSON.parse(localStorage.getItem('tennisMyProfile')) || { strengths: '', weaknesses: '' };
        const opponentStrengths = currentOpponent.strengths.join(', ');
        const opponentWeaknesses = currentOpponent.weaknesses.join(', ');

        const prompt = `
            You are a world-class tennis coach creating a hyper-personalized game plan for me.

            First, here is my player profile:
            - My Strengths: ${myProfile.strengths || 'Not specified.'}
            - My Weaknesses: ${myProfile.weaknesses || 'Not specified.'}

            Now, here is the profile of my opponent, ${currentOpponent.name}:
            - Their Playing Style: ${currentOpponent.style || 'Unknown'}
            - Their Strengths: ${opponentStrengths || 'None listed.'}
            - Their Weaknesses: ${opponentWeaknesses || 'None listed.'}
            - Mental/Psychological Notes: ${currentOpponent.mentalNotes || 'None listed.'}

            Your task is to create a concise, actionable game plan using Markdown.
            1.  Start with a brief strategic overview under a '### Strategic Overview' heading.
            2.  Provide 3-5 key tactical bullet points under a '### Key Tactics' heading, with each point starting with '* '.
            3.  Crucially, each tactic must explain HOW I can use MY STRENGTHS to exploit THEIR WEAKNESSES and MENTAL state.
            4.  If there are mental notes, suggest specific ways to create psychological pressure.
            5.  Be direct and use "You should..." or "Your goal is to..." language.
        `;
        
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const rawText = data.candidates[0].content.parts[0].text;
                const tacticsHtml = markdownToHtml(rawText);
                
                currentOpponent.tactics = tacticsHtml;
                
                let allOpponents = getOpponents();
                let updatedOpponents = allOpponents.map(opp => opp.id == opponentId ? currentOpponent : opp);
                saveOpponents(updatedOpponents);
                renderDetails();
            } else {
                 if (data.candidates && data.candidates[0].finishReason === 'SAFETY') {
                     throw new Error("Response blocked due to safety settings.");
                }
                throw new Error("Invalid response format from API.");
            }
        } catch (error) { 
             console.error("Error generating tactics:", error);
            tacticsOutput.innerHTML = `<p style="color: red;"><strong>Error:</strong> Could not generate tactics.</p>`;
        } 
        finally { 
            generateTacticsBtn.disabled = false; 
        }
    };

    generateTacticsBtn.addEventListener('click', generateTactics);

    // --- Initial Load ---
    renderDetails();
});