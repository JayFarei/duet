// pdf2png.swift <in.pdf> <out.png> <scale>: rasterizes the first page of a PDF at a scale, keeping transparency.
import AppKit
let a = CommandLine.arguments
guard a.count == 4, let doc = CGPDFDocument(URL(fileURLWithPath: a[1]) as CFURL), let page = doc.page(at: 1), let s = Double(a[3]) else {
  FileHandle.standardError.write("usage: pdf2png in.pdf out.png scale\n".data(using: .utf8)!); exit(1)
}
let box = page.getBoxRect(.mediaBox)
let w = Int((box.width * s).rounded()), h = Int((box.height * s).rounded())
let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.scaleBy(x: s, y: s)
ctx.translateBy(x: -box.minX, y: -box.minY)
ctx.drawPDFPage(page)
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
