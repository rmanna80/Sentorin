# Smart pen BLE tag — KiCad project, revision 0.3 candidate (NOT released for fabrication)

Open `smartpen.kicad_pro` in KiCad 7 or newer. No Gerbers, drill, CPL or STEP files are included:
ERC has not been run and the items under "Release blockers" are open.

## Changes in the 0.3 candidate (owner's measurement of Fanstel's EV-BC832 V2 Gerbers)

| Item | Fanstel EV board (owner-measured) | 0.2.1 | 0.3 candidate |
|---|---|---|---|
| Edge land, along the row | ~0.70 mm | 0.67 | **0.70** |
| Edge land, inner end (heel) from module centre | ~3.25 mm | 3.30 | **3.25** (matches) |
| Edge land, outer end (toe) from module centre | ~4.55 mm | 4.05 | **4.20** |
| Toe beyond the 7.8 mm module body | 0.65 mm | 0.15 | **0.30** |
| LGA land diameter | ~0.60 mm | 0.50 | **0.60** |
| Pitches (1.10 / 1.20 mm), pad counts | — | match | match |

- Fanstel's full land (toe at 4.55 mm) needs copper out to 9.1 mm plus edge clearance, i.e. a board about 9.6 mm wide, which does not fit even the 9.5 mm bore. The toe is therefore the one remaining deviation: 0.30 mm instead of 0.65 mm. Heel and width now follow Fanstel.
- **Board is now 8.9 mm wide and requires the 9.5 mm bore** (0.28 mm at the PCB corner; only 0.10 mm in a 9.14 mm bore).
- Strict antenna keep-out ends at x = 3.1 mm because Fanstel's first row of 0.6 mm LGA lands reaches x = 3.18 mm.
- DC/DC order confirmed by the owner from the EV-BC832 V2 schematic (DCC -> 10 uH -> 15 nH -> DEC4, SW7 on for V1). No change.
- Local result (KiCad 7.0.11): DRC 0 violations, 0 unconnected; netlist cross-check matches. **Re-run ERC and DRC in your KiCad.**
- The Gerber figures are the owner's; the designer has not seen the files. The module's own pad dimensions (not the EV board's lands) are still worth requesting from Fanstel to justify the 0.30 mm toe.

## Changes in 0.2.1 (from the owner's ERC/DRC run in a newer KiCad)

| Finding | Fix |
|---|---|
| DRC error: bottom GND pour reached the board edge (0.0005 mm, rule 0.25 mm). KiCad 7's scripted fill did not apply the edge rule and its DRC did not flag it | Pour outline is now drawn 0.3 mm inside the edge; the generator asserts the filled area stays clear |
| ERC: 0 errors, 16 warnings "symbol library 'smartpen' not configured" | Added `smartpen.kicad_sym` and `sym-lib-table` |
| DRC: 6 warnings "footprint does not match library copy" for stock parts | All footprints now come from the project library `smartpen.pretty` |
| L1/L2 order | Owner reports Fanstel's EV-BC832 V2 schematic shows 10 uH on the DCC side and 15 nH on the DEC4 side. This board is wired DCC -> L1 10 uH -> L2 15 nH -> DEC4, which agrees. Not read first-hand by the designer |
| L1 rating | Owner checked LBMF1608T100K: 80 mA rated, above Nordic's 50 mA minimum |

Local result after these fixes (KiCad 7.0.11): DRC 0 violations, 0 unconnected; netlist cross-check matches. **Re-run ERC and DRC in your KiCad to confirm.**

## Changes from revision 0.1

| Decision | What changed |
|---|---|
| Shorten the board | 12.35 mm -> **11.35 mm** (8.6 mm wide, unchanged) |
| Move Q1 | Q1 is now on the bottom; battery pads J1/J2 moved to the top rear strip |
| SWDIO via | Moved out of the 3.2 mm antenna strip |
| Fewer tracks under the module | The VDD lane that ran under pins 9-13 is gone; VDD drops to the bottom at pin 16. Top-side tracks under the module are now only the DCC/DEC4 escapes and the SWDCLK stub |
| Inductors | L1 = Taiyo Yuden LBMF1608T100K (10 uH 0603), L2 = Taiyo Yuden HK100515NJ-T (15 nH 0402) |
| MOSFET | AO3401A checked against the AOS datasheet (below) |
| Bore | Clearances now reported for both 9.14 mm and 9.50 mm |

## Validation status

| Check | Result | How |
|---|---|---|
| DRC | 0 violations locally after the 0.2.1 fixes; owner's run of 0.2 found 1 error (fixed) | KiCad 7.0.11 `WriteDRCReport`, `validation/drc_report.txt` |
| Schematic = board netlist | **Match** (8 nets, 13 parts) | `validation/netlist_crosscheck.txt` |
| ERC | Owner's run of 0.2: **0 errors**, 16 library warnings (addressed in 0.2.1) | re-run to confirm |
| AO3401A | Pin 1 gate, 2 source, 3 drain. RDS(on) < 85 mOhm at VGS = -2.5 V; threshold -0.5 to -1.3 V | AOS datasheet |
| DC/DC inductors | 10 uH is the buck inductor, 15 nH filters it; both required, in series between DCC and DEC4 | Nordic DevZone; **series order not confirmed against Fanstel's EV-BC832 schematic** |
| BC832 land pattern | **Not verified against Fanstel** (agrees across two independent community footprints) | compare with Fanstel Gerber/PADS files |
| Mechanical | Calculated only, `validation/mechanical_envelope.json` | — |
| RF, battery pulse, NFC | **Nothing measured** | — |

### MOSFET gate drive in this circuit (calculation)
Gate is tied to GND, so VGS = -VDD: about -3.1 V with fresh cells and -2.4 V at end of life.
-2.4 V is 0.1 V short of the datasheet's -2.5 V test point, so the 85 mOhm limit is not guaranteed there,
but it is 1.1 V beyond the worst-case threshold. At the 5.3 mA radio peak even 1 Ohm would drop only 5 mV.
With the cells reversed the gate sits above the source and the body diode is reverse-biased, so the load sees no reverse voltage.

## Mechanical (calculated, board centred on the bore axis)

| Feature | Clearance, 9.14 mm bore | Clearance, 9.50 mm bore |
|---|---|---|
| PCB corner (8.9 mm board) | 0.10 mm | 0.28 mm |
| BC832 top corner | 0.32 mm | 0.50 mm |
| Q1 body on the bottom (1.25 mm tall, outer edge 3.85 mm off-centre) | 0.38 mm | 0.56 mm |
| C1/C2 on the bottom | 1.46 mm | 1.64 mm |

JLCPCB's outline tolerance is +/-0.2 mm. **The 9.50 mm bore is now required.**

### Proposed battery/contact stack-up (nominal, to be designed in CAD and measured)

| Element | Length |
|---|---|
| PCB | 11.35 mm |
| BAT+ contact: formed spring tab soldered to J1, reaching the bore axis | 1.0 mm |
| Cell 1 (can = positive, facing the board) | 2.66 mm max |
| Cell 2 | 2.66 mm max |
| BAT- conical spring in the rear cap, working height | 1.2 mm |
| Left for cap face and tolerances | **1.43 mm** of 20.3 mm |

- The cell cans are positive on their side walls, so the cells need an insulating sleeve (about 7.0 mm ID) inside the metal barrel.
- Negative return from the cap spring to J2: either the metal rear barrel plus a wiper contact on J2, or a strip along the sleeve. Not decided.
- The module (8.8 mm) sits fully inside the 10 mm plastic front section; the last 1.35 mm of the board is inside the metal barrel.
- The cap must be child-resistant (tool or two simultaneous motions). Check current button-cell regulations for your markets.

## Release blockers

1. **ERC** in KiCad.
2. **BC832 footprint** against Fanstel's files; **L1/L2 series order** against the EV-BC832 schematic.
3. **Battery pulse test** (treat as blocking). Suggested bench test before any pen is built: power the board from a supply through a series resistor to emulate the cells: 3.1 V / 30 Ohm (fresh) and 2.4 V / 180 Ohm (end of life, datasheet worst-case resistance). Scope VDD during advertising at 0 dBm. Pass: VDD stays above 1.9 V and no resets over 10,000 events. Repeat with real cells at room temperature and at 0 C.
4. **Bulk capacitor leakage and real capacitance at 3 V** on the chosen 47 uF part.
5. **Antenna**: pins 1 (GND), 3 (SWDIO) and 16 (VDD) sit beside the antenna, so their lands, three short tracks and the GND via remain inside the strip. Range-test in a representative housing.
6. **Castellated lands** have a 0.30 mm toe (Fanstel EV board: 0.65 mm): reflow only; confirm joint quality on first articles.
7. **Contact stack-up, sleeve, cap** designed and measured.
8. **NFC tag** in the plastic cap selected and read-tested with several phones.
9. Remaining BOM lines marked "from memory" confirmed.

## Regenerating

`generator/build_pcb.py` then `generator/build_sch.py` (KiCad 7 Python). Both read one netlist.
