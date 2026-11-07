"""Make a PDF-compatible CID CFF font without changing Copperplate outlines."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.cffLib import FDArrayIndex, FontDict, FDSelect
from fontTools.ttLib.tables.DefaultTable import DefaultTable
root = Path(__file__).resolve().parents[1] / 'public/invoice-fonts'
font = TTFont(root / 'copperplate.otf')
cff = font['CFF '].cff
top = cff.topDictIndex[0]
# Expand legacy accented composite instructions before CID conversion.
glyphs = font.getGlyphSet()
converted = {}
for name in top.charset:
    pen = T2CharStringPen(glyphs[name].width, glyphs)
    glyphs[name].draw(pen)
    converted[name] = pen.getCharString(private=top.Private, globalSubrs=cff.GlobalSubrs)
for name, charstring in converted.items():
    top.CharStrings[name] = charstring
font.recalcBBoxes = False
old_names = top.charset
names = ['.notdef'] + [f'cid{i:05d}' for i in range(1, len(old_names))]
top.CharStrings.charStrings = {new: top.CharStrings.charStrings[old] for old, new in zip(old_names, names)}
top.charset = names
top.ROS = ('Adobe', 'Identity', 0)
top.CIDCount = len(names)
fd = FontDict(strings=cff.strings, GlobalSubrs=cff.GlobalSubrs)
fd.Private = top.Private
fd.FontName = 'Copperplate-Bold'
top.FDArray = FDArrayIndex()
top.FDArray.append(fd)
top.FDSelect = FDSelect(format=3)
top.FDSelect.gidArray = [0] * len(names)
del top.Private
# Compile before replacing the parsed table; the remaining OpenType tables keep
# their original glyph IDs, metrics, Unicode mapping and exact vector outlines.
data = font['CFF '].compile(font)
raw = DefaultTable('CFF ')
raw.data = data
raw.cff = cff
font['CFF '] = raw
font.save(root / 'copperplate-pdf.otf')
