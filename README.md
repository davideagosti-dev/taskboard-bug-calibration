# TaskBoard Bug Calibration

Mini React app with intentional bugs for Autonomous AI calibration.

## Goals

- Root cause analysis
- Patch generation
- Regression testing
- L4 → L5 evaluation

## Known Bug Areas

- State mutation
- Memoization
- Sorting
- Derived state
- Keys
- Abort handling

## Usage

npm install  
npm run dev


## Lista bug (per calibrazione)
- Se vuoi usarla come benchmark “a livelli”, questi sono i bug target:
- Key sbagliata (index) → toggling errato dopo sort/filter.
- Sorting muta lo state (list.sort su array referenziato) → comportamento instabile.
- Memo dependencies mancanti → UI non aggiorna correttamente al cambio filter/sort.
- State update non funzionale (setTasks(tasks.concat…)) → race/stale state con adds rapidi.
- Mutation in-place (t.done = !t.done) → side effects, memo broken.
- Stats come derived state → drift + calcoli sbagliati.
- donePct può diventare NaN (divisione per zero + deps errate).
- AbortError trattato come errore → flash di errore al unmount.