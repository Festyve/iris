import Foundation
import Vision
import AppKit
var result: [String: [[String: Any]]] = [:]
for arg in CommandLine.arguments.dropFirst() {
 let request = VNRecognizeTextRequest()
 request.recognitionLevel = .accurate
 request.usesLanguageCorrection = false
 try VNImageRequestHandler(url: URL(fileURLWithPath:arg)).perform([request])
 result[URL(fileURLWithPath:arg).deletingPathExtension().lastPathComponent] = (request.results ?? []).compactMap { item in
 guard let text = item.topCandidates(1).first else { return nil }
 let b = item.boundingBox
 return ["text":text.string,"box":[b.minX,1-b.maxY,b.width,b.height],"confidence": text.confidence]
 }
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:result,options:[.sortedKeys]))
