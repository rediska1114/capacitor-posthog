import Foundation

@objc public class CapacitorPosthog: NSObject {
    @objc public func echo(_ value: String) -> String {
        print(value)
        return value
    }
}
