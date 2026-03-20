//
//  RivenWidgetBundle.swift
//  RivenWidget
//
//  Created by ab on 3/20/26.
//

import WidgetKit
import SwiftUI

@main
struct RivenWidgetBundle: WidgetBundle {
    var body: some Widget {
        RivenWidget()
        RivenWidgetControl()
        RivenWidgetLiveActivity()
    }
}
