#!/usr/bin/env python3
"""Generate smartpen.kicad_sch (KiCad 7 format) from the same netlist the board uses."""
import json, os, sys, uuid

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
D = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "netlist.json")))
PADNET = {(r, p): n for n, lst in D["netlist"].items() for r, p in lst}
BC = D["bc832_pins"]
U = lambda: str(uuid.uuid4())
ROOT = U()
FONT = "(effects (font (size 1.27 1.27)))"
HIDE = "(effects (font (size 1.27 1.27)) hide)"

# symbol definitions: name -> dict(prefix, left pins, right pins, half width)
def two(n1="1", n2="2"):
    return dict(left=[("1", n1, "passive")], right=[("2", n2, "passive")], hw=3.81)

cast = [str(i) for i in range(1, 17)]
lga = [c + str(r) for c in "ABCD" for r in range(1, 6)]
ptype = lambda n: "power_in" if BC[n] in ("GND", "VDD") else ("passive" if BC[n] in ("DCC", "DEC4") else "bidirectional")
SYMS = {
    "BC832_V1": dict(prefix="U", left=[(n, BC[n], ptype(n)) for n in cast], right=[(n, BC[n], ptype(n)) for n in lga], hw=12.7),
    "C": dict(prefix="C", **two()),
    "L": dict(prefix="L", **two()),
    "PMOS_GSD": dict(prefix="Q", left=[("1", "G", "passive")], right=[("3", "D", "passive"), ("2", "S", "passive")], hw=5.08),
    "PAD": dict(prefix="J", left=[("1", "1", "passive")], right=[], hw=2.54),
    "TESTPAD": dict(prefix="TP", left=[("1", "1", "passive")], right=[], hw=2.54),
    "PWR_FLAG": dict(prefix="#FLG", left=[("1", "pwr", "power_out")], right=[], hw=2.54, power=True),
}


def pin_xy(sym, num):
    s = SYMS[sym]
    for side, lst in (("L", s["left"]), ("R", s["right"])):
        n = len(lst)
        for i, (pn, _, _) in enumerate(lst):
            if pn == num:
                y = ((n - 1) / 2 - i) * 2.54
                x = -(s["hw"] + 2.54) if side == "L" else (s["hw"] + 2.54)
                return side, x, y
    raise KeyError(num)


def lib_symbol(name):
    s = SYMS[name]
    n = max(len(s["left"]), len(s["right"]), 1)
    hh = n * 1.27 + 1.27
    o = [f'    (symbol "smartpen:{name}" {"(power) " if s.get("power") else ""}(pin_names (offset 0.508)) (in_bom {"no" if s.get("power") else "yes"}) (on_board {"no" if s.get("power") else "yes"})']
    o.append(f'      (property "Reference" "{s["prefix"]}" (at 0 {hh + 1.27:.2f} 0) {HIDE if s.get("power") else FONT})')
    o.append(f'      (property "Value" "{name}" (at 0 {-hh - 1.27:.2f} 0) {FONT})')
    o.append(f'      (property "Footprint" "" (at 0 0 0) {HIDE})')
    o.append(f'      (property "Datasheet" "" (at 0 0 0) {HIDE})')
    o.append(f'      (symbol "{name}_0_1" (rectangle (start {-s["hw"]:.2f} {hh:.2f}) (end {s["hw"]:.2f} {-hh:.2f}) (stroke (width 0.254) (type default)) (fill (type background))))')
    o.append(f'      (symbol "{name}_1_1"')
    for lst in (s["left"], s["right"]):
        for pn, nm, ty in lst:
            side, x, y = pin_xy(name, pn)
            o.append(f'        (pin {ty} line (at {x:.2f} {y:.2f} {0 if side == "L" else 180}) (length 2.54) (name "{nm}" {FONT}) (number "{pn}" {FONT}))')
    o.append("      )\n    )")
    return "\n".join(o)


# instances: ref, symbol, value, footprint, x, y, extra fields
PARTS = [
    ("U1", "BC832_V1", "BC832 (V1)", "smartpen:BC832_V1_pen", 149.86, 96.52, {"MPN": "Fanstel BC832 (order the V1 revision)"}),
    ("J1", "PAD", "BAT+ pad", "smartpen:BatteryPad_1.2x3.0mm", 60.96, 60.96, {}),
    ("J2", "PAD", "BAT- pad", "smartpen:BatteryPad_1.2x3.0mm", 60.96, 78.74, {}),
    ("Q1", "PMOS_GSD", "AO3401A", "smartpen:SOT-23", 86.36, 60.96, {"MPN": "AOS AO3401A", "LCSC": "C15127"}),
    ("C1", "C", "47u 6.3V X5R", "smartpen:C_0805_2012Metric", 86.36, 96.52, {"MPN": "Murata GRM21BR60J476ME15L", "LCSC": "C77072"}),
    ("C2", "C", "47u 6.3V X5R", "smartpen:C_0805_2012Metric", 86.36, 109.22, {"MPN": "Murata GRM21BR60J476ME15L", "LCSC": "C77072"}),
    ("C3", "C", "100n 16V X7R", "smartpen:C_0402_1005Metric", 86.36, 121.92, {"MPN": "Samsung CL05B104KO5NNNC", "LCSC": "C1525"}),
    ("L1", "L", "10u 0603", "smartpen:L_0603_1608Metric", 218.44, 86.36, {"MPN": "Taiyo Yuden LBMF1608T100K", "LCSC": "C87216"}),
    ("L2", "L", "15n 0402", "smartpen:L_0402_1005Metric", 218.44, 104.14, {"MPN": "Murata LQG15HS15NJ02D", "LCSC": "C86059"}),
    ("TP1", "TESTPAD", "SWDIO", "smartpen:TestPad_D1.0mm", 104.14, 139.7, {}),
    ("TP2", "TESTPAD", "SWDCLK", "smartpen:TestPad_D1.0mm", 104.14, 147.32, {}),
    ("TP4", "TESTPAD", "VDD", "smartpen:TestPad_D1.0mm", 104.14, 154.94, {}),
    ("TP5", "TESTPAD", "GND", "smartpen:TestPad_D1.0mm", 104.14, 162.56, {}),
    ("#FLG01", "PWR_FLAG", "PWR_FLAG", "", 60.96, 139.7, {}),
    ("#FLG02", "PWR_FLAG", "PWR_FLAG", "", 60.96, 147.32, {}),
    ("#FLG03", "PWR_FLAG", "PWR_FLAG", "", 60.96, 154.94, {}),
]
EXTRA = {("#FLG01", "1"): "VDD", ("#FLG02", "1"): "GND", ("#FLG03", "1"): "VBAT"}

body, used = [], set()
for ref, sym, val, fpn, X, Y, extra in PARTS:
    s = SYMS[sym]
    pw = bool(s.get("power"))
    hh = max(len(s["left"]), len(s["right"]), 1) * 1.27 + 1.27
    o = [f'  (symbol (lib_id "smartpen:{sym}") (at {X:.2f} {Y:.2f} 0) (unit 1) (in_bom {"no" if pw else "yes"}) (on_board {"no" if pw else "yes"}) (dnp no) (uuid {U()})']
    o.append(f'    (property "Reference" "{ref}" (at {X:.2f} {Y - hh - 1.27:.2f} 0) {HIDE if pw else FONT})')
    o.append(f'    (property "Value" "{val}" (at {X:.2f} {Y + hh + 1.27:.2f} 0) {FONT})')
    o.append(f'    (property "Footprint" "{fpn}" (at {X:.2f} {Y:.2f} 0) {HIDE})')
    o.append(f'    (property "Datasheet" "" (at {X:.2f} {Y:.2f} 0) {HIDE})')
    for k, v in extra.items():
        o.append(f'    (property "{k}" "{v}" (at {X:.2f} {Y:.2f} 0) {HIDE})')
    for lst in (s["left"], s["right"]):
        for pn, _, _ in lst:
            o.append(f'    (pin "{pn}" (uuid {U()}))')
    o.append(f'    (instances (project "smartpen" (path "/{ROOT}" (reference "{ref}") (unit 1))))\n  )')
    body.append("\n".join(o))
    for lst in (s["left"], s["right"]):
        for pn, _, _ in lst:
            side, px, py = pin_xy(sym, pn)
            x, y = X + px, Y - py
            netname = PADNET.get((ref, pn)) or EXTRA.get((ref, pn))
            if netname is None:
                body.append(f'  (no_connect (at {x:.2f} {y:.2f}) (uuid {U()}))')
                continue
            used.add((ref, pn))
            x2 = x - 2.54 if side == "L" else x + 2.54
            body.append(f'  (wire (pts (xy {x:.2f} {y:.2f}) (xy {x2:.2f} {y:.2f})) (stroke (width 0) (type default)) (uuid {U()}))')
            ang, just = (180, "right") if side == "L" else (0, "left")
            body.append(f'  (label "{netname}" (at {x2:.2f} {y:.2f} {ang}) (effects (font (size 1.27 1.27)) (justify {just} bottom)) (uuid {U()}))')
missing = set(PADNET) - used
assert not missing, missing

NOTES = [
    (40.64, 30.48, "Smart pen BLE tag - BC832 V1 (nRF52832). 2 x SR626W in series -> J1/J2. Separate passive NTAG213 tag is NOT on this board."),
    (40.64, 35.56, "Q1 = reverse-polarity protection (drain to battery, source to VDD, gate to GND)."),
    (40.64, 40.64, "L1 + L2 = DC-DC inductors required by BC832 V1 (DCC -> 10 uH -> 15 nH -> DEC4). Enable DCDC in firmware."),
    (40.64, 45.72, "No 32.768 kHz crystal: firmware must use the internal LF RC oscillator. Battery level: SAADC internal VDD channel (no divider)."),
    (40.64, 50.8, "UNVERIFIED: BC832 land pattern (community footprints, not Fanstel's drawing); pin 3 = SWDIO per datasheet table. Run ERC before release."),
]
for x, y, t in NOTES:
    body.append(f'  (text "{t}" (at {x:.2f} {y:.2f} 0) (effects (font (size 1.5 1.5)) (justify left bottom)) (uuid {U()}))')

sch = "\n".join([
    f'(kicad_sch (version 20230121) (generator eeschema)\n  (uuid {ROOT})\n  (paper "A4")',
    '  (title_block (title "Smart pen BLE tag") (rev "0.3 - unreleased") (comment 1 "Generated design - not validated for fabrication"))',
    "  (lib_symbols", "\n".join(lib_symbol(n) for n in SYMS), "  )",
    "\n".join(body),
    '  (sheet_instances (path "/" (page "1")))\n)\n'])
open(os.path.join(OUT, "smartpen.kicad_sch"), "w").write(sch)
# rev 0.3: project symbol library so ERC finds 'smartpen'
lib = "(kicad_symbol_lib (version 20220914) (generator smartpen_gen)\n" + "\n".join(lib_symbol(n).replace('(symbol "smartpen:', '(symbol "', 1) for n in SYMS) + "\n)\n"
open(os.path.join(OUT, "smartpen.kicad_sym"), "w").write(lib)
open(os.path.join(OUT, "sym-lib-table"), "w").write('(sym_lib_table\n  (lib (name "smartpen")(type "KiCad")(uri "${KIPRJMOD}/smartpen.kicad_sym")(options "")(descr "Smart pen symbols"))\n)\n')
print("schematic written;", len(PARTS), "symbols")
