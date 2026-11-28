# Assembly files for review — do not manufacture from these

Revision 0.3 candidate, single board 11.35 x 8.9 mm. Prepared so JLCPCB can review assembly feasibility.

| File | Use |
|---|---|
| `BOM_JLCPCB.csv` | Upload as the BOM (Comment, Designator, Footprint, LCSC Part #) |
| `CPL_JLCPCB_single_board.csv` | Upload as the placement file (Designator, Mid X, Mid Y, Layer, Rotation) |
| `BOM_full_with_sources.csv` | Same parts with manufacturer part numbers and how each was checked |

Notes
- Positions are for ONE board, in the same coordinates KiCad uses when plotting Gerbers (origin at the board's front edge centre, Y up). Gerbers must be plotted from the same project without moving the origin.
- 7 parts are placed: U1 on top; C1, C2, C3, L1, L2, Q1 on the bottom. Battery pads J1/J2 and test pads TP1/2/4/5 are bare copper and are not in these files.
- Rotations are KiCad's values. JLCPCB's rotation convention differs for some packages (SOT-23 and bottom-side parts are the usual ones). Check every part in JLCPCB's placement preview and correct there; pin 1 of Q1 is the gate.
- U1 has no LCSC number on purpose. See the notes column in `BOM_full_with_sources.csv`.
- The board is smaller than JLCPCB's minimum for assembly and must be panelised with rails; the placement file then has to be repeated per board, or let JLCPCB panelise.
- Gerbers and drill files are not included here yet.
